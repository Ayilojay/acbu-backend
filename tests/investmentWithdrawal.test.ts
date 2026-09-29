/// <reference types="jest" />
import { processInvestmentWithdrawalAvailability } from "../src/jobs/investmentWithdrawalJob";

// --- mock dependencies ---
jest.mock("../src/config/database", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    investmentWithdrawalRequest: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../src/config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("../src/services/investment/withdrawalNotificationService", () => ({
  publishInvestmentWithdrawalReady: jest.fn(),
}));

import { prisma } from "../src/config/database";
import { publishInvestmentWithdrawalReady } from "../src/services/investment/withdrawalNotificationService";
import { Decimal } from "@prisma/client/runtime/library";

const mockQueryRaw = prisma.$queryRaw as jest.Mock;
const mockFindMany = prisma.investmentWithdrawalRequest.findMany as jest.Mock;
const mockUpdateMany = prisma.investmentWithdrawalRequest.updateMany as jest.Mock;
const mockPublish = publishInvestmentWithdrawalReady as jest.Mock;
const trustedNow = new Date("2026-05-27T12:00:00.000Z");

beforeEach(() => {
  jest.resetAllMocks();
  mockQueryRaw.mockResolvedValue([{ trustedNow }]);
  mockUpdateMany.mockResolvedValue({ count: 1 });
});

describe("processInvestmentWithdrawalAvailability", () => {
  it("should notify user when user withdrawal becomes available", async () => {
    const userId = "user-123";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-1",
        userId,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).toHaveBeenCalledWith(userId, amountAcbu.toNumber(), null, trustedNow);
  });

  it("should notify organization admins when org withdrawal becomes available", async () => {
    const organizationId = "org-123";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-2",
        userId: null,
        organizationId,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).toHaveBeenCalledWith(
      null,
      amountAcbu.toNumber(),
      organizationId,
      trustedNow,
    );
  });

  it("should mark withdrawal as available with notifiedAt timestamp", async () => {
    const userId = "user-456";
    const amountAcbu = new Decimal("50.00");
    const requestId = "request-3";
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: requestId,
        userId,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    await processInvestmentWithdrawalAvailability();

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: requestId,
        status: { in: ["requested", "processing"] },
        availableAt: { lte: trustedNow },
      },
      data: { status: "available", notifiedAt: trustedNow },
    });
  });

  it("should query ready withdrawals using the database clock", async () => {
    mockFindMany.mockResolvedValue([]);

    await processInvestmentWithdrawalAvailability();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["requested", "processing"] },
        availableAt: { lte: trustedNow },
      },
      take: 100,
    });
  });

  it("should skip notifications if both userId and organizationId are null", async () => {
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-4",
        userId: null,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("should handle multiple withdrawal requests in one run", async () => {
    const user1Id = "user-111";
    const org1Id = "org-111";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-5",
        userId: user1Id,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
      {
        id: "request-6",
        userId: null,
        organizationId: org1Id,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledWith(user1Id, amountAcbu.toNumber(), null, trustedNow);
    expect(mockPublish).toHaveBeenCalledWith(null, amountAcbu.toNumber(), org1Id, trustedNow);
  });

  it("should continue processing when one request fails", async () => {
    const userId = "user-222";
    const orgId = "org-222";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-7",
        userId,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
      {
        id: "request-8",
        userId: null,
        organizationId: orgId,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("Update failed"));

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledWith(userId, amountAcbu.toNumber(), null, trustedNow);
    expect(mockPublish).toHaveBeenCalledWith(null, amountAcbu.toNumber(), orgId, trustedNow);
  });

  it("should retry a transient update failure and still publish once it succeeds", async () => {
    const amountAcbu = new Decimal("100.00");
    const requestId = "request-10";

    mockFindMany.mockResolvedValue([
      {
        id: requestId,
        userId: "user-444",
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(trustedNow.getTime() - 1000),
      },
    ]);
    mockUpdateMany
      .mockRejectedValueOnce(new Error("Temporary update failure"))
      .mockResolvedValueOnce({ count: 1 });

    await processInvestmentWithdrawalAvailability();

    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledWith("user-444", amountAcbu.toNumber(), null, trustedNow);
  });

  it("should not publish when another worker already transitioned the request", async () => {
    const amountAcbu = new Decimal("100.00");
    mockFindMany.mockResolvedValue([
      {
        id: "request-9",
        userId: "user-333",
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(trustedNow.getTime() - 1000),
      },
    ]);
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).not.toHaveBeenCalled();
  });
});
