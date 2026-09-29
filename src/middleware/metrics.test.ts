import express, { type Request } from "express";
import request from "supertest";
import {
  getResponseTimeMetrics,
  normalizeEndpoint,
  recordResponseTime,
  requestMetricsMiddleware,
  resetResponseTimeMetrics,
} from "./metrics";

describe("requestMetricsMiddleware", () => {
  beforeEach(() => {
    resetResponseTimeMetrics();
  });

  it("records per-endpoint latency histograms with P50, P95, and P99", () => {
    const endpoint = "GET /api/users";
    const durations = [10, 20, 30, 40, 50, 100, 200, 300, 400, 1000];

    for (const durationMs of durations) {
      recordResponseTime(endpoint, durationMs, {
        "http.method": "GET",
        "http.status_code": 200,
      });
    }

    const [metrics] = getResponseTimeMetrics();
    expect(metrics.endpoint).toBe(endpoint);
    expect(metrics.count).toBe(durations.length);
    expect(metrics.p50).toBe(50);
    expect(metrics.p95).toBe(1000);
    expect(metrics.p99).toBe(1000);
    expect(metrics.buckets.le_50).toBe(5);
    expect(metrics.buckets.le_100).toBe(6);
    expect(metrics.buckets.le_inf).toBe(durations.length);
  });

  it("surfaces tail latency in P95/P99 while P50 stays low", () => {
    const endpoint = "POST /api/transfers";
    const durations = [
      ...Array.from({ length: 80 }, () => 10),
      ...Array.from({ length: 15 }, () => 100),
      ...Array.from({ length: 5 }, () => 2000),
    ];

    for (const durationMs of durations) {
      recordResponseTime(endpoint, durationMs);
    }

    const [metrics] = getResponseTimeMetrics();
    expect(metrics.p50).toBe(10);
    expect(metrics.p95).toBe(100);
    expect(metrics.p99).toBe(2000);
    const average = metrics.sumMs / metrics.count;
    expect(average).toBeGreaterThan(metrics.p50);
    expect(average).toBeLessThan(metrics.p99);
  });

  it("groups metrics by normalized endpoint labels", async () => {
    const app = express();
    app.use(requestMetricsMiddleware);
    app.get("/users/:id", (req, res) => {
      res.status(200).json({ id: req.params.id });
    });

    await request(app).get("/users/1").expect(200);
    await request(app).get("/users/2").expect(200);

    const metrics = getResponseTimeMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].endpoint).toBe("GET /users/:id");
    expect(metrics[0].count).toBe(2);
  });

  it("normalizes route templates when available", () => {
    const req = {
      method: "GET",
      baseUrl: "/api/v1",
      path: "/users/123",
      route: { path: "/users/:id" },
    } as Request;

    expect(normalizeEndpoint(req)).toBe("GET /api/v1/users/:id");
  });
});
