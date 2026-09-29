import type { IncomingMessage } from "http";
import bcrypt from "bcrypt";
import { authenticateWsUpgrade, WsAuthError } from "./wsAuth";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../config/database", () => ({
  prisma: {
    apiKey: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock("../../config/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { prisma } from "../../config/database";

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SECRET = "a".repeat(64);
const VALID_LOOKUP = "b".repeat(12);
const VALID_KEY = `acbu_${VALID_LOOKUP}_${VALID_SECRET}`;

async function makeKeyRecord(overrides: Record<string, unknown> = {}) {
  const keyHash = await bcrypt.hash(VALID_SECRET, 1); // cost=1 for test speed
  return {
    id: "key-id-1",
    lookupKey: VALID_LOOKUP,
    keyHash,
    userId: "user-id-1",
    organizationId: null,
    keyType: "USER_KEY",
    permissions: ["p2p:write"],
    revokedAt: null,
    expiresAt: null,
    emergencyExpiresAt: null,
    emergencyReason: null,
    lastUsedAt: null,
    ...overrides,
  };
}

function makeRequest(headers: Record<string, string>, url = "/"): IncomingMessage {
  return { headers, url } as unknown as IncomingMessage;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("authenticateWsUpgrade", () => {
  const mockFindFirst = prisma.apiKey.findFirst as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  // ── Happy paths ──

  it("authenticates via x-api-key header", async () => {
    mockFindFirst.mockResolvedValueOnce(await makeKeyRecord());
    const req = makeRequest({ "x-api-key": VALID_KEY });
    const result = await authenticateWsUpgrade(req);
    expect(result.keyId).toBe("key-id-1");
    expect(result.userId).toBe("user-id-1");
    expect(result.keyType).toBe("USER_KEY");
    expect(result.permissions).toContain("p2p:write");
  });

  it("authenticates via Authorization: Bearer header", async () => {
    mockFindFirst.mockResolvedValueOnce(await makeKeyRecord());
    const req = makeRequest({ authorization: `Bearer ${VALID_KEY}` });
    const result = await authenticateWsUpgrade(req);
    expect(result.keyId).toBe("key-id-1");
  });

  it("is case-insensitive for 'bearer' prefix", async () => {
    mockFindFirst.mockResolvedValueOnce(await makeKeyRecord());
    const req = makeRequest({ authorization: `BEARER ${VALID_KEY}` });
    await expect(authenticateWsUpgrade(req)).resolves.toBeDefined();
  });

  it("returns null organizationId when not set", async () => {
    mockFindFirst.mockResolvedValueOnce(await makeKeyRecord({ organizationId: null }));
    const req = makeRequest({ "x-api-key": VALID_KEY });
    const result = await authenticateWsUpgrade(req);
    expect(result.organizationId).toBeNull();
  });

  it("returns empty permissions array for invalid permission entries", async () => {
    mockFindFirst.mockResolvedValueOnce(
      await makeKeyRecord({ permissions: ["not_a_real_scope", null, 123] }),
    );
    const req = makeRequest({ "x-api-key": VALID_KEY });
    const result = await authenticateWsUpgrade(req);
    expect(result.permissions).toEqual([]);
  });

  // ── Query string rejection (#384) ──

  it.each(["token", "api_key", "apikey", "access_token", "auth"])(
    "rejects connection when token is in query string param '%s'",
    async (param) => {
      const req = makeRequest({}, `/?${param}=somesecret`);
      await expect(authenticateWsUpgrade(req)).rejects.toThrow(WsAuthError);
      await expect(authenticateWsUpgrade(req)).rejects.toThrow(/query string/);
    },
  );

  it("does NOT reject benign query params that are not token-shaped", async () => {
    mockFindFirst.mockResolvedValueOnce(await makeKeyRecord());
    const req = makeRequest({ "x-api-key": VALID_KEY }, "/?room=general&page=1");
    await expect(authenticateWsUpgrade(req)).resolves.toBeDefined();
  });

  it("query string check runs before DB lookup — no DB call on rejection", async () => {
    const req = makeRequest({}, "/?token=leak");
    await expect(authenticateWsUpgrade(req)).rejects.toThrow(WsAuthError);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  // ── Missing / invalid credentials ──

  it("throws WsAuthError when no auth header is present", async () => {
    const req = makeRequest({});
    await expect(authenticateWsUpgrade(req)).rejects.toThrow(WsAuthError);
    await expect(authenticateWsUpgrade(req)).rejects.toThrow(/header/);
  });

  it("throws WsAuthError for malformed key format", async () => {
    const req = makeRequest({ "x-api-key": "not-a-valid-key" });
    await expect(authenticateWsUpgrade(req)).rejects.toThrow(WsAuthError);
    await expect(authenticateWsUpgrade(req)).rejects.toThrow(/format/);
  });

  it("throws WsAuthError when key not found in DB", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const req = makeRequest({ "x-api-key": VALID_KEY });
    await expect(authenticateWsUpgrade(req)).rejects.toThrow(WsAuthError);
  });

  it("throws WsAuthError on wrong secret (bcrypt mismatch)", async () => {
    const record = await makeKeyRecord();
    // Swap keyHash so bcrypt.compare will fail
    record.keyHash = await bcrypt.hash("wrong_secret".padEnd(64, "z"), 1);
    mockFindFirst.mockResolvedValueOnce(record);
    const req = makeRequest({ "x-api-key": VALID_KEY });
    await expect(authenticateWsUpgrade(req)).rejects.toThrow(WsAuthError);
  });

  it("throws WsAuthError with 401 status code", async () => {
    const req = makeRequest({});
    try {
      await authenticateWsUpgrade(req);
      fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(WsAuthError);
      expect((e as WsAuthError).statusCode).toBe(401);
    }
  });

  // ── WsAuthError class ──

  it("WsAuthError.name is 'WsAuthError'", () => {
    const err = new WsAuthError("test");
    expect(err.name).toBe("WsAuthError");
    expect(err).toBeInstanceOf(Error);
  });

  it("WsAuthError defaults statusCode to 401", () => {
    expect(new WsAuthError("x").statusCode).toBe(401);
  });

  it("WsAuthError accepts custom statusCode 403", () => {
    expect(new WsAuthError("x", 403).statusCode).toBe(403);
  });
});
