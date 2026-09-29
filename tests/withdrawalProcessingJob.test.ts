import { startWithdrawalProcessingConsumer } from "../src/jobs/withdrawalProcessingJob";
import { prisma } from "../src/config/database";
import {
  connectRabbitMQ,
  getRabbitMQChannel,
  QUEUES,
  assertQueueWithDLQ,
} from "../src/config/rabbitmq";
import { getFintechRouter } from "../src/services/fintech";

jest.mock("../src/config/database", () => ({
  prisma: {
    transaction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../src/config/rabbitmq", () => ({
  connectRabbitMQ: jest.fn(),
  getRabbitMQChannel: jest.fn(),
  assertQueueWithDLQ: jest.fn().mockResolvedValue({}),
  QUEUES: {
    WITHDRAWAL_PROCESSING: "withdrawal_processing",
    NOTIFICATIONS: "notifications",
  },
}));

jest.mock("../src/config/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
  logFinancialEvent: jest.fn(),
}));

jest.mock("../src/services/fintech", () => ({
  getFintechRouter: jest.fn(),
}));

describe("WithdrawalProcessingConsumer", () => {
  const mockChannel = {
    consume: jest.fn(),
    ack: jest.fn(),
    nack: jest.fn(),
    sendToQueue: jest.fn(),
    prefetch: jest.fn(),
  };

  const payload = {
    transactionId: "tx-123",
    txHash: "0x123",
  };

  const mockMsg = (retries: number) => ({
    content: Buffer.from(JSON.stringify(payload)),
    properties: {
      headers: {
        "x-retries": retries,
      },
    },
  });

  const mockTx = {
    id: "tx-123",
    type: "burn",
    status: "processing",
    localCurrency: "NGN",
    localAmount: 100,
    recipientAccount: {
      account_number: "1234567890",
      bank_code: "011",
      account_name: "John Doe",
    },
    userId: "user-123",
  };

  const mockProvider = {
    disburseFunds: jest.fn(),
  };

  const mockRouter = {
    getProvider: jest.fn().mockResolvedValue(mockProvider),
    getPreferredProviderId: jest.fn().mockReturnValue("paystack"),
  };

  const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    jest.clearAllMocks();
    (connectRabbitMQ as jest.Mock).mockResolvedValue(mockChannel);
    (getRabbitMQChannel as jest.Mock).mockReturnValue(mockChannel);
    (getFintechRouter as jest.Mock).mockReturnValue(mockRouter);
    mockChannel.prefetch.mockReturnValue(undefined);
  });

  it("should successfully process disbursement and ack the message", async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTx);
    (prisma.transaction.update as jest.Mock).mockResolvedValue({});
    mockProvider.disburseFunds.mockResolvedValue({ transactionId: "fintech-tx-999" });

    mockChannel.consume.mockImplementation((_queue, callback) => {
      callback(mockMsg(0));
    });

    await startWithdrawalProcessingConsumer();
    await flushPromises();

    expect(assertQueueWithDLQ).toHaveBeenCalledWith(QUEUES.WITHDRAWAL_PROCESSING);
    expect(mockProvider.disburseFunds).toHaveBeenCalledWith(100, "NGN", {
      accountNumber: "1234567890",
      bankCode: "011",
      accountName: "John Doe",
    });
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-123" },
      data: expect.objectContaining({ status: "completed" }),
    });
    expect(mockChannel.ack).toHaveBeenCalled();
  });

  it("should retry and increment x-retries header when disbursement fails and retries < max", async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTx);
    mockProvider.disburseFunds.mockRejectedValue(new Error("Outage"));

    mockChannel.consume.mockImplementation((_queue, callback) => {
      callback(mockMsg(2)); // Attempt count = 2
    });

    await startWithdrawalProcessingConsumer();
    await flushPromises();

    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      QUEUES.WITHDRAWAL_PROCESSING,
      expect.any(Buffer),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-retries": 3,
        }),
      }),
    );
    expect(mockChannel.ack).toHaveBeenCalled();
    expect(mockChannel.nack).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it("should permanently fail and nack to DLQ when retry limit is exceeded", async () => {
    (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTx);
    mockProvider.disburseFunds.mockRejectedValue(new Error("Permanent failure"));

    mockChannel.consume.mockImplementation((_queue, callback) => {
      callback(mockMsg(5)); // Attempt count = 5 (equals to Max retries of 5)
    });

    await startWithdrawalProcessingConsumer();
    await flushPromises();

    expect(mockChannel.sendToQueue).not.toHaveBeenCalledWith(
      QUEUES.WITHDRAWAL_PROCESSING,
      expect.any(Buffer),
      expect.any(Object),
    );
    expect(mockChannel.nack).toHaveBeenCalledWith(expect.any(Object), false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "tx-123" },
      data: expect.objectContaining({ status: "failed" }),
    });
  });
});
