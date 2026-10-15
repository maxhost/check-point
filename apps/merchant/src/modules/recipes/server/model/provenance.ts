import type { DbTransaction } from "@mi-pasaporte/db";
import { recipeConsumptionSources } from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import type { CapturedModuleEvent } from "../../../../server/module-events/types";
import type { CapturedSource } from "./captured";

export async function persistProvenance(
  tx: DbTransaction,
  event: CapturedModuleEvent,
  sources: CapturedSource[],
) {
  const rows = await tx
    .select()
    .from(recipeConsumptionSources)
    .where(
      and(
        eq(recipeConsumptionSources.businessId, event.businessId),
        eq(recipeConsumptionSources.sourceOrderId, event.payload.sourceOrderId),
      ),
    );
  const key = (s: CapturedSource) =>
    `${s.sourceLineId}/${s.itemId}/${s.recipeRevisionId}`;
  const existing = new Map(rows.map((r) => [key(r), r]));
  const values = sources.map((s) => ({
    ...s,
    businessId: event.businessId,
    eventId: event.id,
    sourceOrderId: event.payload.sourceOrderId,
    locationId: event.payload.locationId,
  }));
  const expectedKeys = new Set(values.map(key));
  if (
    expectedKeys.size !== values.length ||
    rows.some((r) => !expectedKeys.has(key(r)))
  )
    throw new Error("Consumption provenance snapshot conflict");
  const fresh = values.filter((value) => {
    const previous = existing.get(key(value));
    if (!previous) return true;
    for (const field of Object.keys(value) as (keyof typeof value)[])
      if (previous[field] !== value[field])
        throw new Error("Consumption provenance snapshot conflict");
    return false;
  });
  for (let offset = 0; offset < fresh.length; offset += 1000) {
    const chunk = fresh.slice(offset, offset + 1000);
    const inserted = await tx
      .insert(recipeConsumptionSources)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: recipeConsumptionSources.id });
    if (inserted.length !== chunk.length)
      throw new Error("Consumption provenance snapshot conflict");
  }
}
