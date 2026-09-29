import nodemailer from "nodemailer";
import {
  getSmtpPoolMetrics,
  resetSmtpPoolMetrics,
  sendSmtpEmail,
  sendSmtpEmailBatch,
} from "./emailService";

jest.mock("nodemailer");

jest.mock("../../config/env", () => ({
  config: {
    notification: {
      emailFrom: "noreply@acbu.io",
      smtp: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        maxConnections: 5,
        maxMessages: 100,
      },
    },
  },
}));

jest.mock("../../config/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSendMail = jest.fn();
const mockClose = jest.fn();
const mockIsIdle = jest.fn();

describe("emailService SMTP transport pool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSmtpPoolMetrics();
    mockSendMail.mockResolvedValue({ messageId: "test-id" });
    mockClose.mockResolvedValue(undefined);
    mockIsIdle.mockReturnValue(true);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
      close: mockClose,
      isIdle: mockIsIdle,
    });
  });

  it("closes transport after a batch send completes", async () => {
    await sendSmtpEmailBatch([
      { to: "a@example.com", subject: "One", body: "Body one" },
      { to: "b@example.com", subject: "Two", body: "Body two" },
    ]);

    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(getSmtpPoolMetrics().activeTransports).toBe(0);
    expect(getSmtpPoolMetrics().totalConnectionsClosed).toBe(1);
    expect(getSmtpPoolMetrics().totalBatchesCompleted).toBe(1);
  });

  it("closes transport when a batch send fails mid-way", async () => {
    mockSendMail
      .mockResolvedValueOnce({ messageId: "first" })
      .mockRejectedValueOnce(new Error("SMTP failure"));

    await expect(
      sendSmtpEmailBatch([
        { to: "a@example.com", subject: "One", body: "Body one" },
        { to: "b@example.com", subject: "Two", body: "Body two" },
      ]),
    ).rejects.toThrow("SMTP failure");

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(getSmtpPoolMetrics().activeTransports).toBe(0);
  });

  it("closes transport after a single email send", async () => {
    await sendSmtpEmail("user@example.com", "Hello", "Message body");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(getSmtpPoolMetrics().activeTransports).toBe(0);
  });

  it("tracks pool metrics while a batch is in flight", async () => {
    let resolveSend: ((value?: unknown) => void) | undefined;
    mockSendMail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    const batchPromise = sendSmtpEmailBatch([
      { to: "a@example.com", subject: "One", body: "Body one" },
    ]);

    await Promise.resolve();
    expect(getSmtpPoolMetrics().batchesInFlight).toBe(1);
    expect(getSmtpPoolMetrics().activeTransports).toBe(1);

    resolveSend?.();
    await batchPromise;

    expect(getSmtpPoolMetrics().batchesInFlight).toBe(0);
    expect(getSmtpPoolMetrics().activeTransports).toBe(0);
  });
});
