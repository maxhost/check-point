import { after } from "next/server";
import { retryModuleEvents } from "../../../server/module-events";

/** Call only after the writer's transaction has committed. Durable deliveries remain the fallback. */
export function scheduleExpenseDelivery(businessId: string): void {
  const retry = async () => {
    try {
      await retryModuleEvents({
        businessId,
        eventTypes: ["expense.recorded", "expense.updated", "expense.deleted"],
        subscriberIds: ["core.analytics"],
        budgetMs: 20000,
        batchSize: 50,
      });
    } catch {
      // Acceleration must never turn a committed expense into a failed request.
      // The durable queue and its cron retain responsibility for pending deliveries.
    }
  };
  try {
    after(retry);
  } catch {
    // Direct callers without a Next request context still get a bounded, detached attempt.
    void retry();
  }
}
