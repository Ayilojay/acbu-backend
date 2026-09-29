#!/usr/bin/env bash
# #383: Replica promotion runbook — restore _prisma_migrations on a newly-promoted primary.
#
# Run this BEFORE executing `prisma migrate deploy` against the promoted replica.
#
# Usage:
#   export OLD_PRIMARY="postgresql://user:pass@old-primary:5432/acbu"
#   export NEW_PRIMARY="postgresql://user:pass@new-primary:5432/acbu"
#   ./scripts/ci/restore-migrations.sh
#
# The script:
#   1. Dumps _prisma_migrations rows from the old primary (or from a CSV if the old primary
#      is unavailable — pass the CSV path as $1).
#   2. Upserts them into the new primary via sync_prisma_migrations_from_snapshot().
#   3. Prints a row count summary so you can verify completeness.
#
# After this script succeeds, run `prisma migrate deploy` normally — it will find the
# complete history and become a no-op (all migrations already recorded as applied).

set -euo pipefail

CSV_FILE="${1:-}"
NEW_PRIMARY="${NEW_PRIMARY:?NEW_PRIMARY env var required}"

if [[ -z "$CSV_FILE" ]]; then
  OLD_PRIMARY="${OLD_PRIMARY:?Either OLD_PRIMARY env var or a CSV file path argument is required}"
  CSV_FILE="$(mktemp /tmp/prisma_migrations_XXXXXX.csv)"
  echo "[restore-migrations] Exporting _prisma_migrations from old primary..."
  psql "$OLD_PRIMARY" -c "\COPY \"_prisma_migrations\" TO '$CSV_FILE' CSV HEADER"
  echo "[restore-migrations] Exported to $CSV_FILE"
fi

[[ -f "$CSV_FILE" ]] || { echo "CSV file not found: $CSV_FILE" >&2; exit 1; }

ROW_COUNT=$(tail -n +2 "$CSV_FILE" | wc -l | tr -d ' ')
echo "[restore-migrations] Rows in snapshot: $ROW_COUNT"

# Build a VALUES list from the CSV and call the sync procedure.
# Uses psql's \copy + a temporary table to avoid shell quoting nightmares.
psql "$NEW_PRIMARY" <<SQL
-- Load snapshot into a temp table
CREATE TEMP TABLE _migrations_snapshot (
  id               VARCHAR(36),
  checksum         VARCHAR(64),
  finished_at      TIMESTAMPTZ,
  migration_name   VARCHAR(255),
  logs             TEXT,
  rolled_back_at   TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  applied_steps_count INTEGER
);

\COPY _migrations_snapshot FROM '$CSV_FILE' CSV HEADER

-- Upsert into _prisma_migrations (idempotent)
INSERT INTO "_prisma_migrations" (
  id, checksum, finished_at, migration_name,
  logs, rolled_back_at, started_at, applied_steps_count
)
SELECT id, checksum, finished_at, migration_name,
       logs, rolled_back_at, started_at, applied_steps_count
FROM _migrations_snapshot
ON CONFLICT (id) DO NOTHING;

SELECT
  (SELECT COUNT(*) FROM "_prisma_migrations") AS total_rows,
  (SELECT COUNT(*) FROM _migrations_snapshot) AS snapshot_rows;
SQL

echo "[restore-migrations] Done. Verify total_rows == snapshot_rows above, then run: prisma migrate deploy"
