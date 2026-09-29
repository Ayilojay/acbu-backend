import compression from "compression";
import express from "express";
import request from "supertest";

describe("Compression middleware integration", () => {
  it("should gzip responses larger than 1MB", async () => {
    const app = express();
    app.use(compression());

    app.get("/compression-large-response", (_req, res) => {
      const transactions = Array.from({ length: 12000 }, (_, index) => ({
        transaction_id: `tx-${index}`,
        type: "mint",
        status: "completed",
        recipient_address: "G".repeat(56),
        description: "x".repeat(128),
        local_currency: "NGN",
        amount: "12345.67",
      }));

      res.json({ transactions });
    });

    const response = await request(app)
      .get("/compression-large-response")
      .set("Accept-Encoding", "gzip")
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(response.headers["vary"]).toContain("Accept-Encoding");

    const body = response.body as Buffer;
    const parsed = JSON.parse(body.toString("utf-8")) as { transactions: unknown[] };

    expect(parsed.transactions).toHaveLength(12000);
    expect(body.length).toBeGreaterThan(1024 * 1024);
  });
});
