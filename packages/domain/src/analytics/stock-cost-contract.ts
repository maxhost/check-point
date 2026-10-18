/** Spec0240: exact captured unit costs. Geometry may approximate; labels must preserve precision. */
export type StockCostPoint = {
  date: string;
  amountMinor: string;
  isBaseline: boolean;
};
export type StockCostSeries = {
  id: string;
  itemId: string;
  label: string;
  locationId: string | null;
  locationName: string;
  unit: string;
  points: StockCostPoint[];
};
export type StockCostHistory = {
  from: string;
  to: string;
  currencyCode: string;
  minorUnit: number;
  defaultSeriesId: string | null;
  series: StockCostSeries[];
};
