const {
  findDestructiveStatements,
  getChangedMigrationFiles,
} = require('../scripts/ci/check-destructive-migrations');

describe('check-destructive-migrations', () => {
  it('detects destructive table and column drops', () => {
    const findings = findDestructiveStatements(`
      DROP TABLE "LegacyPayout";
      ALTER TABLE "User" DROP COLUMN "middleName";
    `);

    expect(findings).toEqual([
      expect.objectContaining({ kind: 'DROP TABLE' }),
      expect.objectContaining({ kind: 'DROP COLUMN' }),
    ]);
  });

  it('detects truncate statements', () => {
    const findings = findDestructiveStatements(`
      TRUNCATE TABLE "AuditTrail";
    `);

    expect(findings).toEqual([
      expect.objectContaining({ kind: 'TRUNCATE' }),
    ]);
  });

  it('ignores additive schema changes', () => {
    const findings = findDestructiveStatements(`
      CREATE TABLE "FeatureFlag" (
        "id" TEXT PRIMARY KEY
      );

      ALTER TABLE "Wallet" ADD COLUMN "externalId" TEXT;
    `);

    expect(findings).toEqual([]);
  });

  it('selects only prisma migration sql files', () => {
    const migrationFiles = getChangedMigrationFiles([
      'prisma\\migrations\\20260423000000_unique_transactions_blockchain_tx_hash\\migration.sql',
      'prisma/schema.prisma',
      'prisma/sql/20260323_add_api_key_lookup_key.sql',
      'README.md',
    ]);

    expect(migrationFiles).toEqual([
      'prisma/migrations/20260423000000_unique_transactions_blockchain_tx_hash/migration.sql',
    ]);
  });
});
