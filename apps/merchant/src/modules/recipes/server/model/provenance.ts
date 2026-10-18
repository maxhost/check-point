import type { DbTransaction } from "@mi-pasaporte/db";
import { recipeConsumptionSources } from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import { fromRatio, ratioOf } from "@mi-pasaporte/domain/measures";
import type { CapturedSource } from "./captured";

export async function persistProvenance(
  tx: DbTransaction,
  event: {
    id: string;
    businessId: string;
    payload: { sourceOrderId: string; locationId: string };
  },
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
  const key = (
    s: Pick<CapturedSource, "sourceLineId" | "itemId" | "recipeRevisionId">,
  ) => `${s.sourceLineId}/${s.itemId}/${s.recipeRevisionId}`;
  const existing = new Map(rows.map((r) => [key(r), r]));
  const values = sources.map((s) => {
    const ratios = {
      recipeQuantityNumerator: s.recipeQuantityNumerator ?? null,
      recipeQuantityDenominator: s.recipeQuantityDenominator ?? null,
      exactQuantityNumerator: s.exactQuantityNumerator ?? null,
      exactQuantityDenominator: s.exactQuantityDenominator ?? null,
    };
    const quantityVersion = s.quantityVersion ?? 1;
    if (quantityVersion === 2) {
      for (const [numerator, denominator] of [
        [ratios.recipeQuantityNumerator, ratios.recipeQuantityDenominator],
        [ratios.exactQuantityNumerator, ratios.exactQuantityDenominator],
      ]) {
        if (
          !numerator ||
          !denominator ||
          !/^[1-9][0-9]*$/.test(numerator) ||
          !/^[1-9][0-9]*$/.test(denominator)
        )
          throw new Error("Invalid measured provenance ratio");
        const canonical = ratioOf(fromRatio({ numerator, denominator }));
        if (
          canonical.numerator !== numerator ||
          canonical.denominator !== denominator
        )
          throw new Error("Invalid measured provenance ratio");
      }
    } else if (
      quantityVersion !== 1 ||
      Object.values(ratios).some((v) => v !== null)
    ) {
      throw new Error("Invalid provenance quantity version");
    }
    return {
      ...s,
      quantityVersion,
      ...ratios,
      businessId: event.businessId,
      eventId: event.id,
      sourceOrderId: event.payload.sourceOrderId,
      locationId: event.payload.locationId,
    };
  });
  const expectedKeys = new Set(values.map(key));
  if (
    expectedKeys.size !== values.length ||
    (rows.length > 0 && rows.length !== values.length) ||
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
