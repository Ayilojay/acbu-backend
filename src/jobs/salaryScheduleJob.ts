import { prisma } from "../config/database";
import { triggerSchedule } from "../services/salary/salaryService";
import { logger } from "../config/logger";
import { acquireJobLock, releaseJobLock } from "../utils/jobLock";
import { retryWithBackoff } from "../utils/retry";

const JOB_NAME = "salary-schedule";
const LOCK_TTL_S = 55; // hold for up to 55s (< 60s interval)

/**
 * Checks for and processes due salary schedules.
 * Guarded by a distributed MongoDB lock so only one instance runs per tick (#418).
 */
export async function processSalarySchedules(): Promise<void> {
  const acquired = await acquireJobLock(JOB_NAME, LOCK_TTL_S);
  if (!acquired) {
    logger.debug("Salary schedule job skipped — another instance holds the lock");
    return;
  }
  try {
    await _processSalarySchedules();
  } finally {
    await releaseJobLock(JOB_NAME);
  }
}

async function _processSalarySchedules(): Promise<void> {
  const now = new Date();

  const dueSchedules = await prisma.salarySchedule.findMany({
    where: {
      status: "active",
      nextRunAt: { lte: now },
    },
    take: 50,
  });

  if (dueSchedules.length === 0) return;

  logger.info(`Found ${dueSchedules.length} due salary schedules`);

  for (const schedule of dueSchedules) {
    try {
      await retryWithBackoff(() => triggerSchedule(schedule.id), {
        attempts: 3,
        initialDelayMs: 250,
        onRetry: (error, attempt, delayMs) =>
          logger.warn("Retrying salary schedule trigger", {
            scheduleId: schedule.id,
            attempt,
            delayMs,
            error,
          }),
      });
      logger.info("Triggered salary schedule", { scheduleId: schedule.id });
    } catch (err) {
      logger.error("Failed to trigger salary schedule after retries", {
        scheduleId: schedule.id,
        error: err,
      });
    }
  }
}

/**
 * Start the salary schedule scheduler.
 */
export async function startSalaryScheduleScheduler(): Promise<void> {
  const intervalMs = 60 * 1000; // Run every minute

  setInterval(() => {
    processSalarySchedules().catch((err) => {
      logger.error("Salary schedule job error", { error: err });
    });
  }, intervalMs);

  logger.info("Salary schedule scheduler started", { intervalMs });
}
