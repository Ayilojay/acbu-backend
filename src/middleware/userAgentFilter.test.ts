import express from "express";
import request from "supertest";
import { userAgentFilter } from "./userAgentFilter";
import { errorHandler } from "./errorHandler";

const app = express();
app.get("/test", userAgentFilter, (_req, res) => res.status(200).json({ ok: true }));
app.use(errorHandler);

describe("userAgentFilter", () => {
  const GOOD_UA = "ACBU-Mobile/1.0 (iOS 17)";

  it("allows legitimate user agents", async () => {
    await request(app).get("/test").set("User-Agent", GOOD_UA).expect(200);
  });

  it("blocks missing User-Agent", async () => {
    await request(app)
      .get("/test")
      .unset("User-Agent")
      .expect(400)
      .expect((res) => expect(res.body.error.code).toBe("MISSING_USER_AGENT"));
  });

  it.each([
    ["python-requests/2.28.0"],
    ["curl/7.88.1"],
    ["curl/10.1.0"],
    ["Wget/1.21"],
    ["go-http-client/1.1"],
    ["masscan/1.3"],
    ["Nikto/2.1.6"],
    ["sqlmap/1.7"],
    ["nuclei/2.9.0"],
    ["scrapy/2.11"],
    ["libwww-perl/6.72"],
    ["axios/1.4.0"],
    ["java/17.0.6"],
  ])("blocks %s", async (ua) => {
    await request(app)
      .get("/test")
      .set("User-Agent", ua)
      .expect(403)
      .expect((res) => expect(res.body.error.code).toBe("FORBIDDEN_USER_AGENT"));
  });
});
