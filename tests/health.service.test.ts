const mockQueryRaw = jest.fn();
const mockPing = jest.fn();
const mockGetMongoDB = jest.fn();
const mockGetRabbitMQChannel = jest.fn();
const mockRoot = jest.fn();

jest.mock("../src/config/env", () => ({
  config: {
    nodeEnv: "test",
    port: 5000,
    apiVersion: "v1",
    databaseUrl: "postgresql://test",
    prismaAccelerateUrl: "",
    mongodbUri: "mongodb://test",
    rabbitmqUrl: "amqp://test",
    jwtSecret: "test-secret",
    jwtExpiresIn: "7d",
    apiKeySalt: "",
    rateLimitWindowMs: 60000,
    rateLimitMaxRequests: 100,
    logLevel: "silent",
    logFile: "",
    flutterwave: {},
    paystack: {},
    mtnMomo: {},
    fintech: {},
  },
}));

jest.mock("../src/config/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../src/config/database", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $disconnect: jest.fn(),
  },
}));

jest.mock("../src/config/mongodb", () => ({
  getMongoDB: mockGetMongoDB,
  connectMongoDB: jest.fn(),
  disconnectMongoDB: jest.fn(),
}));

jest.mock("../src/config/rabbitmq", () => ({
  getRabbitMQChannel: mockGetRabbitMQChannel,
  connectRabbitMQ: jest.fn(),
  disconnectRabbitMQ: jest.fn(),
  getRabbitMQConnection: jest.fn(),
}));

jest.mock("../src/services/stellar/eventListener", () => ({
  eventListenerHealth: { status: "up", lastError: null },
}));

jest.mock("../src/services/stellar/client", () => ({
  stellarClient: {
    getServer: jest.fn(() => ({
      root: mockRoot,
    })),
  },
}));

import { getHealthReport, markStartupComplete } from "../src/services/health/healthService";

function setupHealthyDeps() {
  mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
  mockGetMongoDB.mockReturnValue({
    admin: () => ({ ping: mockPing }),
  });
  mockPing.mockResolvedValue({ ok: 1 });
  mockGetRabbitMQChannel.mockReturnValue({});
  mockRoot.mockResolvedValue({});
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("HealthService", () => {
  describe("getHealthReport", () => {
    it("should return all services up when checks pass and startup is complete", async () => {
      setupHealthyDeps();
      markStartupComplete();

      const report = await getHealthReport();

      expect(report.status).toBe("up");
      expect(report.details.postgres.status).toBe("up");
      expect(report.details.mongodb.status).toBe("up");
      expect(report.details.rabbitmq.status).toBe("up");
      expect(report.details.stellarHorizon.status).toBe("up");
      expect(report.details.sorobanEventListener.status).toBe("up");
    });

    it("should report down when stellarHorizon is unreachable", async () => {
      setupHealthyDeps();
      mockRoot.mockRejectedValue(new Error("Connection refused"));
      markStartupComplete();

      const report = await getHealthReport();

      expect(report.details.stellarHorizon.status).toBe("down");
      expect(report.details.stellarHorizon.error).toBe("Stellar Horizon unreachable");
      expect(report.status).toBe("down");
    });
  });
});
