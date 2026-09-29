import { prisma } from "../../config/database";
import { Decimal } from "@prisma/client/runtime/library";
import { getLatestAcbuRate, invalidateAcbuRateCache } from "./acbuRateCache";

jest.mock("../../config/database", () => ({
  prisma: {
    acbuRate: {
      findFirst: jest.fn(),
    },
  },
}));

const mockRate = {
  id: "1",
  acbuUsd: new Decimal("0.50"),
  acbuNgn: new Decimal("1000"),
  timestamp: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  invalidateAcbuRateCache();
});

describe("getLatestAcbuRate", () => {
  it("fetches from DB on first call", async () => {
    (prisma.acbuRate.findFirst as jest.Mock).mockResolvedValue(mockRate);

    const result = await getLatestAcbuRate();

    expect(result).toBe(mockRate);
    expect(prisma.acbuRate.findFirst).toHaveBeenCalledTimes(1);
  });

  it("returns cached value on second call within TTL", async () => {
    (prisma.acbuRate.findFirst as jest.Mock).mockResolvedValue(mockRate);

    await getLatestAcbuRate();
    await getLatestAcbuRate();

    expect(prisma.acbuRate.findFirst).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent misses into one DB query", async () => {
    (prisma.acbuRate.findFirst as jest.Mock).mockResolvedValue(mockRate);

    const [a, b, c] = await Promise.all([
      getLatestAcbuRate(),
      getLatestAcbuRate(),
      getLatestAcbuRate(),
    ]);

    expect(prisma.acbuRate.findFirst).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("throws when no rate row exists", async () => {
    (prisma.acbuRate.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getLatestAcbuRate()).rejects.toThrow("ACBU rates not available");
  });

  it("re-fetches after invalidation", async () => {
    (prisma.acbuRate.findFirst as jest.Mock).mockResolvedValue(mockRate);

    await getLatestAcbuRate();
    invalidateAcbuRateCache();
    await getLatestAcbuRate();

    expect(prisma.acbuRate.findFirst).toHaveBeenCalledTimes(2);
  });
});
