/**
 * Edge-case tests for the CORS middleware.
 * Core allow/deny/preflight behaviour is covered in tests/cors.test.ts.
 * This file focuses on the whitelist-enforcement properties that are most
 * relevant to the security boundary: no silent reflection of arbitrary origins.
 */
import express from "express";
import request from "supertest";
import { createCorsMiddleware, resolveCorsOrigin } from "./cors";

const ALLOWED = ["https://app.example.com", "https://admin.example.com"];

function buildApp(allowedOrigins: string[]) {
  const app = express();
  app.use(createCorsMiddleware(allowedOrigins));
  app.get("/ping", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("resolveCorsOrigin — whitelist strictness", () => {
  it("does not match a differently-cased origin", () => {
    expect(resolveCorsOrigin("https://APP.EXAMPLE.COM", ALLOWED)).toBe(false);
  });

  it("does not match a subdomain of an allowed origin", () => {
    expect(resolveCorsOrigin("https://sub.app.example.com", ALLOWED)).toBe(false);
  });

  it("does not match an allowed origin with a different port", () => {
    expect(resolveCorsOrigin("https://app.example.com:8080", ALLOWED)).toBe(false);
  });

  it("does not match an allowed origin with a path appended", () => {
    expect(resolveCorsOrigin("https://app.example.com/extra", ALLOWED)).toBe(false);
  });
});

describe("createCorsMiddleware — security-relevant headers", () => {
  const app = buildApp(ALLOWED);

  it("sets Vary: Origin so caches do not serve one origin's response to another", async () => {
    const res = await request(app)
      .get("/ping")
      .set("Origin", "https://app.example.com")
      .expect(200);

    expect(res.headers["vary"]).toMatch(/origin/i);
  });

  it("passes requests with no Origin header (non-browser / server-to-server)", async () => {
    await request(app).get("/ping").expect(200);
  });

  it("does not set Access-Control-Allow-Origin when there is no Origin header", async () => {
    const res = await request(app).get("/ping").expect(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("blocks preflight from an unknown origin", async () => {
    const res = await request(app)
      .options("/ping")
      .set("Origin", "https://attacker.example.com")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("never emits Access-Control-Allow-Origin: * (incompatible with credentials)", async () => {
    const res = await request(app)
      .get("/ping")
      .set("Origin", "https://app.example.com")
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
