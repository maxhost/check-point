import { buildDashboardSummary } from "@mi-pasaporte/domain/analytics/dashboard-summary-calculation";
import { readInput } from "./queries";

/** One projection read, independent of Inbox exposure and evaluation. */
export async function readDashboardSummary(
  businessId: string,
  now = new Date(),
) {
  const input = await readInput(businessId, now);
  return buildDashboardSummary(input, now);
}
