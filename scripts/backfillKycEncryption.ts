import "dotenv/config";
import { prisma } from "../src/config/database";
import { isEncrypted } from "../src/utils/piiEncryption";

const APPLY_FLAG = "--apply";
const applyChanges = process.argv.includes(APPLY_FLAG);

async function main(): Promise<void> {
  const records = await prisma.kycApplication.findMany({
    where: {
      OR: [
        { machineRedactedPayload: { not: null } },
        { machineExtractedPayload: { not: null } },
      ],
    },
  });

  const unencrypted = records.filter((r) => {
    const redacted = r.machineRedactedPayload;
    const extracted = r.machineExtractedPayload;
    return (
      (typeof redacted === "string" && !isEncrypted(redacted)) ||
      (typeof extracted === "string" && !isEncrypted(extracted))
    );
  });

  console.log(
    `[kyc-backfill] total records with payloads: ${records.length}`,
  );
  console.log(
    `[kyc-backfill] unencrypted payloads to backfill: ${unencrypted.length}`,
  );

  if (!applyChanges) {
    console.log(
      `[kyc-backfill] dry-run only. Re-run with ${APPLY_FLAG} to encrypt.`,
    );
    return;
  }

  let updated = 0;
  for (const record of unencrypted) {
    await prisma.kycApplication.update({
      where: { id: record.id },
      data: {
        machineRedactedPayload: record.machineRedactedPayload,
        machineExtractedPayload: record.machineExtractedPayload,
      },
      select: { id: true },
    });
    updated++;
    if (updated % 50 === 0) {
      console.log(`[kyc-backfill] progress: ${updated}/${unencrypted.length}`);
    }
  }

  console.log(`[kyc-backfill] done. Encrypted ${updated} records.`);
}

main().catch((error) => {
  console.error("[kyc-backfill] failed:", error);
  process.exit(1);
});
