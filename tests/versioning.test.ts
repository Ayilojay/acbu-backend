import { Request, Response, NextFunction } from "express";
import {
  versioningMiddleware,
  SUNSET_DATES,
  DEPRECATION_DATES,
} from "../src/middleware/versioning";

// config.apiVersion defaults to "v1" in tests (API_VERSION env not set)

function makeRes() {
  const res = {
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn((key: string, value: string) => {
      res.headers[key] = value;
    }),
  };
  res.status.mockReturnValue(res);
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

describe("versioningMiddleware", () => {
  const next = jest.fn() as NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(SUNSET_DATES).forEach((k) => delete SUNSET_DATES[k]);
    Object.keys(DEPRECATION_DATES).forEach((k) => delete DEPRECATION_DATES[k]);
  });

  it("sets X-API-Version header and calls next for current version", () => {
    const req = { path: "/api/v1/health" } as Request;
    const res = makeRes();
    versioningMiddleware(req, res as unknown as Response, next);
    expect(res.headers["X-API-Version"]).toBe("v1");
    expect(next).toHaveBeenCalled();
  });

  it("calls next for paths without a version segment", () => {
    const req = { path: "/health" } as Request;
    const res = makeRes();
    versioningMiddleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 410 Gone and does NOT call next for a sunset version", () => {
    SUNSET_DATES["v0"] = "2024-01-01T00:00:00Z";
    const req = { path: "/api/v0/users" } as Request;
    const res = makeRes();
    versioningMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Gone",
        sunsetDate: "2024-01-01T00:00:00Z",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("sets Sunset and Warning headers for a sunset version", () => {
    SUNSET_DATES["v0"] = "2024-01-01T00:00:00Z";
    const req = { path: "/api/v0/users" } as Request;
    const res = makeRes();
    versioningMiddleware(req, res as unknown as Response, next);
    expect(res.headers["Sunset"]).toBe("2024-01-01T00:00:00Z");
    expect(res.headers["Warning"]).toMatch(/sunset/i);
  });

  it("sets Deprecation and Warning headers but calls next for a deprecated version", () => {
    DEPRECATION_DATES["v0"] = "2025-01-01T00:00:00Z";
    const req = { path: "/api/v0/users" } as Request;
    const res = makeRes();
    versioningMiddleware(req, res as unknown as Response, next);
    expect(res.headers["Deprecation"]).toBe("2025-01-01T00:00:00Z");
    expect(res.headers["Warning"]).toMatch(/deprecated/i);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("sunset takes precedence over deprecation when both are set", () => {
    SUNSET_DATES["v0"] = "2024-01-01T00:00:00Z";
    DEPRECATION_DATES["v0"] = "2023-01-01T00:00:00Z";
    const req = { path: "/api/v0/users" } as Request;
    const res = makeRes();
    versioningMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(410);
    expect(next).not.toHaveBeenCalled();
  });
});
