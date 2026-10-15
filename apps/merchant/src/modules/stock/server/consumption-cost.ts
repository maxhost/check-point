import type { DbTransaction } from "@mi-pasaporte/db";
import { locations, stockMovements } from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import { ModuleError } from "../../errors";
import { fromDb } from "../../decimal";
import {
  consumptionAmount,
  formatConsumptionAmount,
} from "../consumption-money";

export type CostState = "completo" | "incompleto" | "pendiente";
export type ExpectedCostLine = {
  sourceLineId: string;
  productId: string | null;
  recipe: "present" | "absent" | "unknown";
  consumptions: { itemId: string; quantity: string }[];
  roundingOmissions?: boolean;
  incompleteRecipe?: boolean;
};
export type ConsumptionDelivery = {
  state: "pending" | "processing" | "applied" | "skipped" | "unknown";
  terminalReason?: string | null;
};
export type CostMovement = Pick<
  typeof stockMovements.$inferSelect,
  | "sourceLineId"
  | "productId"
  | "itemId"
  | "quantity"
  | "consumptionUnitCost"
  | "consumptionLossFactor"
  | "consumptionCurrencyCode"
  | "consumptionMinorUnits"
>;
export type CostSummary = {
  state: CostState;
  currencyCode: string | null;
  minorUnits: number | null;
  knownCost: string | null;
  missingRecipes: { sourceLineId: string; productId: string | null }[];
  missingPrices: { itemId: string; sourceLineIds: string[] }[];
  reasons: string[];
};
export type LineCost = CostSummary & {
  sourceLineId: string;
  productId: string | null;
};
export type SaleConsumptionCost = CostSummary & { lines: LineCost[] };

function amounts(rows: readonly CostMovement[]) {
  const metadata = new Map<
    string,
    { currencyCode: string; minorUnits: number }
  >();
  let amount = 0n,
    known = 0;
  for (const row of rows) {
    if (
      row.consumptionCurrencyCode === null ||
      row.consumptionMinorUnits === null ||
      row.consumptionLossFactor === null
    )
      continue;
    metadata.set(
      `${row.consumptionCurrencyCode}/${row.consumptionMinorUnits}`,
      {
        currencyCode: row.consumptionCurrencyCode,
        minorUnits: row.consumptionMinorUnits,
      },
    );
    if (row.consumptionUnitCost !== null) {
      amount += consumptionAmount(
        row.quantity,
        row.consumptionUnitCost,
        row.consumptionLossFactor,
      );
      known++;
    }
  }
  const single = metadata.size === 1 ? [...metadata.values()][0] : null;
  return {
    currencyCode: single?.currencyCode ?? null,
    minorUnits: single?.minorUnits ?? null,
    knownCost:
      known > 0 && single
        ? formatConsumptionAmount(amount, single.minorUnits)
        : null,
    reasons: metadata.size > 1 ? ["moneda_inconsistente"] : [],
  };
}

/** Pure evaluator. Coverage comes from the caller; this module knows no recipe provider. */
export function summarizeConsumptionCost(
  expected: readonly ExpectedCostLine[],
  delivery: ConsumptionDelivery,
  movements: readonly CostMovement[],
): SaleConsumptionCost {
  const pending =
    delivery.state === "pending" || delivery.state === "processing";
  const coverage = new Map(expected.map((line) => [line.sourceLineId, line]));
  const byLine = new Map<string, CostMovement[]>();
  for (const row of movements) {
    if (!row.sourceLineId) continue;
    const rows = byLine.get(row.sourceLineId) ?? [];
    rows.push(row);
    byLine.set(row.sourceLineId, rows);
    if (!coverage.has(row.sourceLineId))
      coverage.set(row.sourceLineId, {
        sourceLineId: row.sourceLineId,
        productId: row.productId,
        recipe: "unknown",
        consumptions: [],
      });
  }
  const lines: LineCost[] = [...coverage.values()].map((line) => {
    const rows = byLine.get(line.sourceLineId) ?? [];
    const sum = amounts(rows);
    const reasons = [...sum.reasons];
    if (line.roundingOmissions) reasons.push("redondeo_sin_consumo");
    const missingRecipes =
      line.recipe === "absent" || line.incompleteRecipe
        ? [{ sourceLineId: line.sourceLineId, productId: line.productId }]
        : [];
    if (missingRecipes.length) reasons.push("sin_receta");
    if (line.recipe === "unknown") reasons.push("sin_informacion");
    const missingPrices = rows
      .filter(
        (row) =>
          row.consumptionLossFactor !== null &&
          row.consumptionUnitCost === null,
      )
      .map((row) => ({
        itemId: row.itemId,
        sourceLineIds: [line.sourceLineId],
      }));
    if (missingPrices.length) reasons.push("sin_precio");
    if (rows.some((row) => row.consumptionLossFactor === null))
      reasons.push("snapshot_ausente");
    if (
      delivery.state === "skipped" &&
      delivery.terminalReason !== "modules_disabled"
    )
      reasons.push("fallo_terminal");
    if (delivery.state === "unknown") reasons.push("sin_informacion");
    if (delivery.state === "applied" && line.recipe === "present") {
      const matches =
        (rows.length > 0 || line.roundingOmissions === true) &&
        rows.length === line.consumptions.length &&
        line.consumptions.every((ingredient) =>
          rows.some(
            (row) =>
              row.itemId === ingredient.itemId &&
              row.productId === line.productId &&
              fromDb(row.quantity, 3) === -fromDb(ingredient.quantity, 3),
          ),
        );
      if (!matches) reasons.push("consumo_inconsistente");
    }
    const uniqueReasons = [...new Set(reasons)];
    const state: CostState =
      pending && line.recipe !== "absent"
        ? "pendiente"
        : uniqueReasons.length || delivery.state !== "applied"
          ? "incompleto"
          : "completo";
    return {
      ...sum,
      state,
      sourceLineId: line.sourceLineId,
      productId: line.productId,
      reasons: uniqueReasons,
      missingRecipes,
      missingPrices,
    };
  });
  const sum = amounts(movements);
  const reasons = [
    ...new Set([...sum.reasons, ...lines.flatMap((line) => line.reasons)]),
  ];
  if (!lines.length) reasons.push("sin_informacion");
  const state: CostState = lines.some((line) => line.state === "pendiente")
    ? "pendiente"
    : !lines.length ||
        reasons.length ||
        lines.some((line) => line.state === "incompleto")
      ? "incompleto"
      : "completo";
  const missing = new Map<string, Set<string>>();
  for (const line of lines)
    for (const item of line.missingPrices) {
      const ids = missing.get(item.itemId) ?? new Set<string>();
      item.sourceLineIds.forEach((id) => ids.add(id));
      missing.set(item.itemId, ids);
    }
  return {
    ...sum,
    state,
    lines,
    reasons,
    missingRecipes: lines.flatMap((line) => line.missingRecipes),
    missingPrices: [...missing].map(([itemId, ids]) => ({
      itemId,
      sourceLineIds: [...ids],
    })),
  };
}

/** Caller owns a consistent read-only transaction and supplies captured normalized coverage. */
export async function readConsumptionCost(
  tx: DbTransaction,
  args: {
    businessId: string;
    locationId: string;
    sourceOrderId: string;
    expectedLines: ExpectedCostLine[];
    delivery: ConsumptionDelivery;
  },
) {
  const [location] = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, args.businessId),
        eq(locations.id, args.locationId),
      ),
    );
  if (!location)
    throw new ModuleError(404, "location_not_found", "Ese local no existe.");
  const rows = await tx
    .select({
      sourceLineId: stockMovements.sourceLineId,
      productId: stockMovements.productId,
      itemId: stockMovements.itemId,
      quantity: stockMovements.quantity,
      consumptionUnitCost: stockMovements.consumptionUnitCost,
      consumptionLossFactor: stockMovements.consumptionLossFactor,
      consumptionCurrencyCode: stockMovements.consumptionCurrencyCode,
      consumptionMinorUnits: stockMovements.consumptionMinorUnits,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, args.businessId),
        eq(stockMovements.locationId, args.locationId),
        eq(stockMovements.sourceOrderId, args.sourceOrderId),
        eq(stockMovements.kind, "consumption"),
      ),
    );
  return summarizeConsumptionCost(args.expectedLines, args.delivery, rows);
}
