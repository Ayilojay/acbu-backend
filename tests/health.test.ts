/**
 * Health service unit tests.
 *
 * All factories are self-contained (no outer-scope variable references)
 * so jest.mock hoisting works correctly. We retrieve the mock functions
 * via jest.mocked() after the imports.
 */

const mockQueryRaw = jest.fn();
const mockPing = jest.fn();
const mockGetMongoDB = jest.fn();
const mockGetRabbitMQChannel = jest.fn();
const mockDisconnect = jest.fn();
const mockStellarRoot = jest.fn();

// ── Mock every module that gets transitively loaded ───────────────────────────

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
    $disconnect: mockDisconnect,
  },
  default: {
    $queryRaw: mockQueryRaw,
    $disconnect: mockDisconnect,
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

jest.mock("../src/services/stellar/client", () => ({
  stellarClient: {
    getServer: jest.fn(() => ({
      root: mockStellarRoot,
    })),
  },
}));

jest.mock("../src/services/stellar/eventListener", () => ({
  eventListenerHealth: { status: "up", lastError: null },
}));

// ── Import SUT after mocks are in place ───────────────────────────────────────
import { getHealthReport, markStartupComplete } from "../src/services/health/healthService";
import { prisma } from "../src/config/database";
import { disconnectMongoDB } from "../src/config/mongodb";
import { disconnectRabbitMQ } from "../src/config/rabbitmq";

// ── Helpers ───────────────────────────────────────────────────────────────────
function setupHealthyDeps() {
  mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
  mockGetMongoDB.mockReturnValue({
    admin: () => ({ ping: mockPing }),
  });
  mockPing.mockResolvedValue({ ok: 1 });
  mockGetRabbitMQChannel.mockReturnValue({});
  mockStellarRoot.mockResolvedValue({});
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("getHealthReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns status 'up' when all dependencies are healthy", async () => {
    setupHealthyDeps();
    markStartupComplete();

    const report = await getHealthReport();

    expect(report.status).toBe("up");
    expect(report.details.postgres.status).toBe("up");
    expect(report.details.mongodb.status).toBe("up");
    expect(report.details.rabbitmq.status).toBe("up");
    expect(report.details.stellarHorizon.status).toBe("up");
    expect(report.timestamp).toBeTruthy();
    expect(typeof report.uptime).toBe("number");
  });

  it("returns status 'down' when PostgreSQL connection is lost", async () => {
    mockQueryRaw.mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:5432"));
    mockGetMongoDB.mockReturnValue({
      admin: () => ({ ping: mockPing }),
    });
    mockPing.mockResolvedValue({ ok: 1 });
    mockGetRabbitMQChannel.mockReturnValue({});
    mockStellarRoot.mockResolvedValue({});

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.postgres.status).toBe("down");
    expect(report.details.postgres.error).toBe("PostgreSQL unreachable");
    expect(report.details.mongodb.status).toBe("up");
    expect(report.details.rabbitmq.status).toBe("up");
    expect(report.details.stellarHorizon.status).toBe("up");
  });

  it("returns status 'down' when MongoDB is unreachable", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockImplementation(() => {
      throw new Error("MongoNetworkError: connect ECONNREFUSED");
    });
    mockGetRabbitMQChannel.mockReturnValue({});
    mockStellarRoot.mockResolvedValue({});

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.mongodb.status).toBe("down");
    expect(report.details.mongodb.error).toBe("MongoDB unreachable");
  });

  it("returns status 'down' when RabbitMQ is unreachable", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockReturnValue({
      admin: () => ({ ping: mockPing }),
    });
    mockPing.mockResolvedValue({ ok: 1 });
    mockGetRabbitMQChannel.mockImplementation(() => {
      throw new Error("RabbitMQ not connected. Call connectRabbitMQ() first.");
    });
    mockStellarRoot.mockResolvedValue({});

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.rabbitmq.status).toBe("down");
    expect(report.details.rabbitmq.error).toBe("RabbitMQ unreachable");
  });

  it("returns 'down' when Stellar Horizon is unreachable", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockReturnValue({
      admin: () => ({ ping: mockPing }),
    });
    mockPing.mockResolvedValue({ ok: 1 });
    mockGetRabbitMQChannel.mockReturnValue({});
    mockStellarRoot.mockRejectedValue(new Error("Connection refused"));

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.stellarHorizon.status).toBe("down");
    expect(report.details.stellarHorizon.error).toBe("Stellar Horizon unreachable");
  });

  it("returns 'down' when a check exceeds the 2s timeout", async () => {
    mockQueryRaw.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 10_000)),
    );
    mockGetMongoDB.mockReturnValue({
      admin: () => ({ ping: mockPing }),
    });
    mockPing.mockResolvedValue({ ok: 1 });
    mockGetRabbitMQChannel.mockReturnValue({});
    mockStellarRoot.mockResolvedValue({});

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.postgres.status).toBe("down");
  }, 10_000);

  it("returns 'down' when Stellar Horizon times out", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockReturnValue({
      admin: () => ({ ping: mockPing }),
    });
    mockPing.mockResolvedValue({ ok: 1 });
    mockGetRabbitMQChannel.mockReturnValue({});
    mockStellarRoot.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 10_000)),
    );

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.stellarHorizon.status).toBe("down");
    expect(report.details.stellarHorizon.error).toBe("Stellar Horizon unreachable");
  }, 10_000);

  afterAll(async () => {
    if (prisma?.$disconnect) await prisma.$disconnect();

    await disconnectMongoDB();

    await disconnectRabbitMQ();

    jest.useRealTimers();
  });
});
