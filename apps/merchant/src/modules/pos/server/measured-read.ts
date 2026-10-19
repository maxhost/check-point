import {
  buildFinancialAmountsFromSnapshots,
  type FinancialLine,
  type FinancialSettlement,
} from "@mi-pasaporte/domain/financial";
import {
  parseMeasure,
  parseQuantity,
  parsePrice,
  trustedUnitSnapshotPrice,
  trustedUnitSnapshotQuantity,
  trustedUnitLegacyPrice,
  trustedUnitLineCents,
} from "@mi-pasaporte/domain/measures";
import {
  add,
  formatMinor,
  originalMoney,
  toMinor,
  minorUnitForCurrency,
} from "@mi-pasaporte/domain/financial/rational";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
import type { PosLineV2, SaleType } from "../contracts";

export function posUpgradeRequired(): never {
  throw new CounterError(
    409,
    "pos_client_upgrade_required",
    "Actualiza la aplicación para leer esta venta.",
  );
}

export type MeasuredSnapshot = {
  id: string;
  productId: string | null;
  name: string;
  quantity: string;
  unitPrice: string;
  position: number;
  measureKind: string;
  quantityUnit: string;
  priceUnit: string;
  conversionVersion: string;
  financialSnapshot: FinancialLine | null;
};

export function snapshotMeasure(
  line: Pick<
    MeasuredSnapshot,
    "measureKind" | "quantityUnit" | "priceUnit" | "conversionVersion"
  >,
) {
  return parseMeasure({
    kind: line.measureKind,
    quantityUnit: line.quantityUnit,
    priceUnit: line.priceUnit,
    conversionVersion: line.conversionVersion,
  });
}

/** Check metadata before the legacy reader performs any numeric projection. */
export function assertLegacySnapshot(line: MeasuredSnapshot): void {
  try {
    if (snapshotMeasure(line).kind !== "unit") posUpgradeRequired();
    trustedUnitSnapshotQuantity(line.quantity);
    trustedUnitLegacyPrice(line.unitPrice);
  } catch {
    posUpgradeRequired();
  }
}

export function measuredItems(
  lines: readonly MeasuredSnapshot[],
  currencyCode: string,
  historical = false,
  settlement: FinancialSettlement | null = null,
): PosLineV2[] {
  const settledLines = new Map(
    settlement?.lines.map((line) => [line.sourceLineId, line]) ?? [],
  );
  const items = lines.map((line) => {
    const measure = snapshotMeasure(line);
    const frozen = line.financialSnapshot ?? settledLines.get(line.id) ?? null;
    return {
      lineId: line.id,
      productId: line.productId,
      name: line.name,
      quantity:
        measure.kind === "unit"
          ? trustedUnitSnapshotQuantity(line.quantity)
          : parseQuantity(line.quantity),
      unitPrice:
        measure.kind === "unit"
          ? trustedUnitSnapshotPrice(line.unitPrice)
          : parsePrice(line.unitPrice),
      measure,
      lineTotal:
        frozen?.money.gross ??
        (historical && measure.kind === "unit"
          ? formatMinor(trustedUnitLineCents(line.quantity, line.unitPrice), 2)
          : ""),
      financialSnapshot: frozen,
    };
  });
  // Settled snapshots remain authoritative. Compute only missing financial lines,
  // using their stored tariff and measure, never today's product catalogue.
  const missing = items.filter((line) => line.lineTotal === "");
  if (missing.length) {
    const amounts = buildFinancialAmountsFromSnapshots({
      currencyCode,
      discount: null,
      lines: missing.map((line) => ({
        ...line,
        sourceLineId: line.lineId,
        position: lines.find((stored) => stored.id === line.lineId)!.position,
      })),
    });
    const financial = new Map(
      amounts.lines.map((line) => [line.sourceLineId, line]),
    );
    for (const line of missing) {
      const snapshot = financial.get(line.lineId)!;
      line.lineTotal = snapshot.money.gross;
    }
  }
  return items;
}

export function persistedSaleType(
  value: string | null,
  tableId: string | null,
): SaleType {
  if (value === null) return tableId ? "table" : "legacy";
  if (["table", "pickup", "delivery", "counter", "legacy"].includes(value))
    return value as SaleType;
  throw new Error("invalid_persisted_sale_type");
}

/** Historical unit orders had exact cent amounts even in zero-minor currencies.
 * Only current open amounts normalize to today's currency; settled totals come from settlement.
 */
export function measuredTotal(
  items: readonly Pick<PosLineV2, "lineTotal">[],
  currencyCode: string,
  historical: boolean,
): string {
  const sum = items.reduce(
    (total, line) => add(total, originalMoney(line.lineTotal)),
    originalMoney("0.00"),
  );
  const minorUnit = historical ? 2 : minorUnitForCurrency(currencyCode);
  return formatMinor(toMinor(sum, minorUnit), minorUnit);
}
