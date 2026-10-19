import type { FinancialSettlement } from "@mi-pasaporte/domain/financial";
import { FinancialError } from "@mi-pasaporte/domain/financial";
import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import {
  exactSnapshotLineGross,
  parseMeasure,
  type LineMeasure,
} from "@mi-pasaporte/domain/measures";

/** Internal server snapshots only. The producer must obtain these fields from its
 * locked, authorized source, never from an arbitrary HTTP body. Historical unit
 * snapshots retain their trusted limits; new captures are validated upstream.
 */
export type MeasuredGrantItem = {
  sourceLineId: string;
  productId: string | null;
  nameSnapshot: string;
  unitPrice: string;
  quantity: string;
  measure: LineMeasure;
  /** Authoritative allocated gross, before the order's discount. */
  lineTotal: string;
};

/** Validate an already decided settlement, without selecting coupons, redistributing
 * money, or inferring the original tariff from rounded line totals. Source references
 * are opaque producer identifiers, unrelated to generated core.order_item ids.
 */
export function measuredGrantItems(input: {
  items: readonly MeasuredGrantItem[];
  settlement: FinancialSettlement;
  total: string;
  currencyCode: string;
}): MeasuredGrantItem[] {
  assertFinancialSettlement(input.settlement);
  const invalid = () => {
    throw new FinancialError("invalid_financial_input");
  };
  if (
    input.total !== input.settlement.collected ||
    input.currencyCode !== input.settlement.currencyCode ||
    input.items.length !== input.settlement.lines.length
  )
    invalid();
  const financial = new Map(
    input.settlement.lines.map((line) => [line.sourceLineId, line]),
  );
  return input.items.map((item) => {
    // Require strings even on the trusted unit path; never downcast exact decimals.
    if (typeof item.quantity !== "string" || typeof item.unitPrice !== "string")
      invalid();
    const line = financial.get(item.sourceLineId);
    if (!line || item.lineTotal !== line.money.gross) invalid();
    financial.delete(item.sourceLineId);
    const measure = parseMeasure(item.measure);
    const gross = exactSnapshotLineGross(
      item.quantity,
      item.unitPrice,
      measure,
    );
    const original = line!.money.originals.gross;
    if (
      gross.numerator !== original.numerator ||
      gross.denominator !== original.denominator
    )
      invalid();
    // Preserve the original validated strings, including harmless storage padding.
    return { ...item, measure };
  });
}
