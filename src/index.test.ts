jest.mock("./config/mongodb", () => ({
  connectMongoDB: jest.fn(),
  disconnectMongoDB: jest.fn(async () => undefined),
}));

jest.mock("./config/rabbitmq", () => ({
  connectRabbitMQ: jest.fn(),
  disconnectRabbitMQ: jest.fn(async () => undefined),
}));

jest.mock("./config/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { shutdown, setHttpServer } from "./gracefulShutdown";
import { disconnectMongoDB } from "./config/mongodb";
import { disconnectRabbitMQ } from "./config/rabbitmq";

describe("HTTP graceful shutdown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHttpServer(null);
  });

  it("calls closeIdleConnections when available and waits for server close", async () => {
    const closeIdleConnections = jest.fn();
    const close = jest.fn((callback) => {
      callback?.(undefined);
    });

    setHttpServer({ closeIdleConnections, close } as any);

    await shutdown();

    expect(closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnectMongoDB).toHaveBeenCalledTimes(1);
    expect(disconnectRabbitMQ).toHaveBeenCalledTimes(1);
  });

  it("closes the server even if closeIdleConnections is unavailable", async () => {
    const close = jest.fn((callback) => {
      callback?.(undefined);
    });

    setHttpServer({ close } as any);

    await shutdown();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
