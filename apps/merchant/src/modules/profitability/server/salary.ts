import { and, asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { profitabilityFixedCosts as costs } from "@mi-pasaporte/db/schema";
import { listStaffLocationTimeline } from "../../../server/staff-location-timeline";
import type { StaffLocationsChange } from "../../route-table";
import { equivalentPeriods, salaryPeriods } from "../intervals";
import { loadPeriods, savePeriods } from "./repository";

/** Core already holds business/person locks. No guard/toggle: maintenance runs while OFF. */
export async function staffLocationsChanged(
  tx: DbTransaction,
  change: StaffLocationsChange,
) {
  const salaries = await tx
    .select()
    .from(costs)
    .where(
      and(
        eq(costs.businessId, change.businessId),
        eq(costs.personId, change.personId),
      ),
    )
    .orderBy(asc(costs.id))
    .for("update");
  if (!salaries.length) return;
  const timeline = await listStaffLocationTimeline(
    tx,
    change.businessId,
    change.personId,
  );
  for (const salary of salaries) {
    const before = await loadPeriods(tx, change.businessId, salary.id);
    const after = salaryPeriods(before, timeline);
    if (equivalentPeriods(before, after)) continue;
    await savePeriods(tx, change.businessId, salary.id, before, after);
    await tx
      .update(costs)
      .set({ revision: salary.revision + 1, updatedAt: new Date() })
      .where(
        and(eq(costs.businessId, change.businessId), eq(costs.id, salary.id)),
      );
  }
}
