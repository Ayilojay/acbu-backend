import { getRabbitMQChannel, QUEUES } from "../../config/rabbitmq";

/**
 * Publishes the investment withdrawal readiness notification from the service
 * layer so background jobs do not depend on HTTP controllers.
 */
export async function publishInvestmentWithdrawalReady(
  userId: string | null,
  amountAcbu: number,
  organizationId: string | null | undefined,
  occurredAt: Date,
): Promise<void> {
  const ch = getRabbitMQChannel();
  await ch.assertQueue(QUEUES.NOTIFICATIONS, { durable: true });
  ch.sendToQueue(
    QUEUES.NOTIFICATIONS,
    Buffer.from(
      JSON.stringify({
        type: "investment_withdrawal_ready",
        userId,
        organizationId: organizationId ?? null,
        amountAcbu,
        timestamp: occurredAt.toISOString(),
      }),
    ),
    { persistent: true },
  );
}
