import express from "express";
import request from "supertest";
import { cacheSemiStatic } from "../src/middleware/cacheHeaders";

describe("cacheSemiStatic middleware", () => {
  const app = express();

  beforeAll(() => {
    app.get("/test-cache", cacheSemiStatic, (_req, res) => {
      res.status(200).json({ data: "ok" });
    });
  });

  it("should set Cache-Control and Surrogate-Control headers", async () => {
    const response = await request(app).get("/test-cache").expect(200);

    expect(response.headers["cache-control"]).toBe(
      "public, max-age=3600, stale-while-revalidate=600",
    );
    expect(response.headers["surrogate-control"]).toBe("max-age=86400");
  });
});
