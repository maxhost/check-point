import { fromDb, formatDecimal, roundDiv } from "../../decimal";
export type StockFact = {
  eventVersion: 1;
  movementId: string;
  itemId: string;
  itemLabel: string;
  itemUnit: string;
  locationId: string;
  occurredAt: string;
  observedAt: string;
  quantity: string;
  onHandAfter: string;
  currencyCode: string;
  minorUnit: number;
};
export type PurchaseRecorded = StockFact & {
  totalCost: string | null;
  unitCostBefore: string | null;
  unitCostAfter: string | null;
};
export type AdjustmentRecorded = StockFact & {
  countedQuantity: string;
  theoreticalQuantity: string;
  unitCost: string | null;
  gapAmountMinor: string | null;
};
export const stockMoneyMinor = (major: string, minorUnit: number) =>
  String(roundDiv(fromDb(major, 6), 10n ** BigInt(6 - minorUnit)));
export const gapMoneyMinor = (
  quantity: string,
  cost: string,
  minorUnit: number,
) =>
  String(
    roundDiv(
      fromDb(quantity, 3) * fromDb(cost, 6),
      10n ** BigInt(9 - minorUnit),
    ),
  );
/** Unit cost preserves all six original decimal places even in currencies with zero decimals. */
export const exactMinorCost = (major: string, minorUnit: number) =>
  formatDecimal(fromDb(major, 6) * 10n ** BigInt(minorUnit), 6);
