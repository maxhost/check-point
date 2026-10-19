import {
  buildFinancialAmountsFromSnapshots,
  type FinancialLine,
} from "@mi-pasaporte/domain/financial";
import {
  parseMeasure,
  parseQuantity,
  parsePrice,
  trustedUnitSnapshotPrice,
  trustedUnitSnapshotQuantity,
  trustedUnitLegacyPrice,
} from "@mi-pasaporte/domain/measures";
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
): PosLineV2[] {
  const items = lines.map((line) => {
    const measure = snapshotMeasure(line);
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
      lineTotal: line.financialSnapshot?.money.gross ?? "",
      financialSnapshot: line.financialSnapshot,
    };
  });
  // Settled snapshots remain authoritative. Compute only missing financial lines,
  // using their stored tariff and measure, never today's product catalogue.
  const missing = items.filter((line) => !line.financialSnapshot);
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
      line.financialSnapshot = snapshot;
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
