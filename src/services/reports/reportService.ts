import { Prisma } from "@prisma/client";
import { prismaReplica } from "../../config/database";

/**
 * Fetches user transaction history (type in mint, burn, transfer) for a specific calendar month.
 * Runs strictly on the read-replica database client.
 */
export async function getMonthlyStatements(
  whereClause: Prisma.TransactionWhereInput,
  limit: number,
) {
  return prismaReplica.transaction.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      acbuAmount: true,
      acbuAmountBurned: true,
      usdcAmount: true,
      localCurrency: true,
      localAmount: true,
      fee: true,
      createdAt: true,
    },
  });
}

/**
 * Fetches user data graph matching GDPR export criteria.
 * Runs strictly on the read-replica database client.
 */
export async function getAuditExports(userId: string) {
  return prismaReplica.user.findUnique({
    where: { id: userId },
    include: {
      apiKeys: true,
      guardians: true,
      wardGuardians: true,
      kycApplications: true,
      kycValidators: true,
      onRampSwaps: true,
      otpChallenges: true,
      transactions: true,
      contacts: true,
      contactOf: true,
      passkeys: true,
      salaryBatches: true,
      salarySchedules: true,
    },
  });
}

/**
 * Fetches all transaction records matching filter criteria for the treasury/regulatory reports.
 * Runs strictly on the read-replica database client.
 */
export async function getTransactionsForTreasuryReport() {
  return prismaReplica.transaction.findMany({
    where: {
      status: { in: ["completed", "processing"] },
      type: { in: ["mint", "burn", "transfer"] },
    },
    select: {
      type: true,
      localCurrency: true,
      acbuAmount: true,
      acbuAmountBurned: true,
    },
  });
}

/**
 * Fetches the latest reserves distinct by currency and segment.
 * Runs strictly on the read-replica database client.
 */
export async function getLatestReserves() {
  return prismaReplica.reserve.findMany({
    orderBy: { timestamp: "desc" },
    distinct: ["currency", "segment"],
    select: {
      currency: true,
      segment: true,
      reserveAmount: true,
      reserveValueUsd: true,
      timestamp: true,
    },
  });
}
