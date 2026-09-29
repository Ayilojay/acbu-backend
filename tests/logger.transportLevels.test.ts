import { resolveTransportLogLevels } from "../src/config/logger";

describe("resolveTransportLogLevels", () => {
  it("defaults production console and file to info even when LOG_LEVEL is debug", () => {
    expect(
      resolveTransportLogLevels({
        nodeEnv: "production",
        logLevel: "debug",
      }),
    ).toEqual({
      console: "info",
      file: "info",
      error: "error",
    });
  });

  it("allows debug on console and file in non-production when LOG_LEVEL is debug", () => {
    expect(
      resolveTransportLogLevels({
        nodeEnv: "development",
        logLevel: "debug",
      }),
    ).toEqual({
      console: "debug",
      file: "debug",
      error: "error",
    });
  });

  it("honours explicit per-transport overrides", () => {
    expect(
      resolveTransportLogLevels({
        nodeEnv: "production",
        logLevel: "debug",
        logConsoleLevel: "warn",
        logFileLevel: "error",
      }),
    ).toEqual({
      console: "warn",
      file: "error",
      error: "error",
    });
  });
});
