import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database (orchestrator)...');

  const args = process.argv.slice(2);
  const truncate = args.includes('--truncate');

  if (truncate) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_TRUNCATE !== 'true') {
      console.error('Refusing to truncate database in production. Set ALLOW_SEED_TRUNCATE=true to override.');
      process.exit(1);
    }

    console.log('Truncating seed-target tables (conservative list)...');
    // Use a Postgres TRUNCATE with CASCADE for speed and to avoid FK ordering issues.
    // Keep this list conservative: only tables that may be created by seeding/demo scripts.
    const tables = [
      'webhooks',
      'reserve_history',
      'reserves',
      'transactions',
      'salary_items',
      'salary_schedules',
      'salary_batches',
      'on_ramp_swaps',
      'api_keys',
      'user_devices',
      'user_passkeys',
      'otp_challenges',
      'user_contacts',
      'guardians',
      'salary_items',
      'users',
      'organizations',
      'basket_config',
      'investment_strategy'
    ];

    const sql = `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`;

    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('Truncated:', tables.join(', '));
    } catch (e) {
      // If raw TRUNCATE fails (non-Postgres, permissions, etc), fall back to conservative deletes.
      console.warn('Raw TRUNCATE failed, falling back to deleteMany for each model:', e);
      try {
        await prisma.$transaction([
          prisma.webhook.deleteMany({}),
          prisma.reserveHistory.deleteMany({}),
          prisma.reserve.deleteMany({}),
          prisma.transaction.deleteMany({}),
          prisma.salaryItem.deleteMany({}),
          prisma.salarySchedule.deleteMany({}),
          prisma.salaryBatch.deleteMany({}),
          prisma.onRampSwap.deleteMany({}),
          prisma.apiKey.deleteMany({}),
          prisma.userDevice.deleteMany({}),
          prisma.userPasskey.deleteMany({}),
          prisma.otpChallenge.deleteMany({}),
          prisma.userContact.deleteMany({}),
          prisma.guardian.deleteMany({}),
          prisma.user.deleteMany({}),
          prisma.organization.deleteMany({}),
          prisma.basketConfig.deleteMany({}),
          prisma.investmentStrategy.deleteMany({}),
        ], { maxWait: 20000 });
        console.log('Deleted records from seed-target models (fallback).');
      } catch (e2) {
        console.error('Error truncating/deleting seed tables:', e2);
        await prisma.$disconnect();
        process.exit(1);
      }
    }
  }

  try {
    console.log('Running prisma/seed.ts');
    execSync('pnpm exec ts-node prisma/seed.ts', { stdio: 'inherit' });

    console.log('Running prisma/seedStrategies.ts');
    execSync('pnpm exec ts-node prisma/seedStrategies.ts', { stdio: 'inherit' });

    console.log('All seeds completed successfully.');
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('Unexpected error in seed orchestrator:', e);
  process.exit(1);
});
