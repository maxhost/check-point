import type {
  FinancialLine,
  FinancialSettlement,
  PaymentInput,
} from "@mi-pasaporte/domain/financial";
import {
  trustedUnitSnapshotQuantity,
  trustedUnitSnapshotPrice,
  parseMeasure,
  parsePrice,
  type Decimal,
  type LineMeasure,
  type MassUnit,
  type MeasureUnit,
} from "@mi-pasaporte/domain/measures";

export const POS_CONTRACT_VERSION = "2" as const;
export type SaleType = "table" | "pickup" | "delivery" | "counter" | "legacy";
export type PosStatus = "open" | "closed" | "voided";
export type PosLocationV2 = { id: string; name: string };
export type PosLineV2 = {
  lineId: string;
  productId: string | null;
  name: string;
  quantity: Decimal;
  unitPrice: Decimal;
  measure: LineMeasure;
  lineTotal: string;
  financialSnapshot?: FinancialLine | null;
};
export type PosSaleV2 = {
  consumer: string;
  total: string;
  grossTotal: string;
  unitsGranted: number;
  balanceAfter: number;
  kind: "points" | "stamps";
  coupon: {
    label: string;
    discountAmount: string;
    extraUnits: number | null;
  } | null;
};
export type PosOrderV2 = {
  contractVersion: 2;
  id: string;
  status: PosStatus;
  version: number;
  saleType: SaleType;
  orderLabel: string;
  /** Transitional reader alias; never infer saleType from this label. */
  tableLabel: string;
  tableId: string | null;
  location: PosLocationV2 | null;
  note: string | null;
  business: { name: string; currencyCode: string };
  items: PosLineV2[];
  total: string;
  createdAt: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string | null;
  sale: PosSaleV2 | null;
  settlement: FinancialSettlement | null;
};
export type PosSummaryV2 = Pick<
  PosOrderV2,
  | "id"
  | "status"
  | "version"
  | "saleType"
  | "orderLabel"
  | "tableId"
  | "location"
  | "createdAt"
  | "closedAt"
  | "total"
> & {
  lineCount: number;
  saleTotal: string | null;
  physicalTotals?: { unit: "unit" | "g"; quantity: Decimal }[];
};
export type PosHistoryV2 = {
  open: PosSummaryV2[];
  closedToday: PosSummaryV2[];
};
export type CatalogProductV2 = {
  id: string;
  name: string;
  categoryId: string | null;
  soldByWeight: boolean;
  pricingUnit: MeasureUnit;
  unitPrice: Decimal | null;
  unitCost: Decimal | null;
  catalogRevision: string;
  imagePath: string | null;
  imageVersion: number;
  imageSource: string | null;
  imageAuthor: string | null;
  imageAuthorUrl: string | null;
  imageSourceUrl: string | null;
  availableAllLocations: boolean;
  locationIds: string[];
};
export type PosCatalogProductV2 = Pick<
  CatalogProductV2,
  | "id"
  | "name"
  | "categoryId"
  | "soldByWeight"
  | "pricingUnit"
  | "unitPrice"
  | "catalogRevision"
  | "imagePath"
>;
export type PosCatalogV2 = {
  products: PosCatalogProductV2[];
  categories: { id: string; name: string }[];
  frequentProductIds: string[];
};
export type SalesUnitsV2 = { salesMassUnits: MassUnit[]; revision: number };
export type CatalogWriteV2 = Pick<
  CatalogProductV2,
  | "name"
  | "categoryId"
  | "soldByWeight"
  | "pricingUnit"
  | "unitPrice"
  | "unitCost"
  | "availableAllLocations"
  | "locationIds"
>;
export type CatalogUpdateV2 = CatalogWriteV2 & {
  expectedSalesRevision: number;
};
export type PosNewLineV2 = {
  lineId?: never;
  productId: string;
  quantity: Decimal;
  quantityUnit: MeasureUnit;
  catalogRevision: string;
};
export type PosExistingLineV2 = {
  lineId: string;
  productId: string | null;
  quantity: Decimal;
  quantityUnit: MeasureUnit;
  catalogRevision?: never;
};
export type PosCreateV2 = {
  createRequestId: string;
  saleType: Exclude<SaleType, "legacy">;
  orderLabel?: string;
  locationId: string | null;
  tableId: string | null;
  note: string | null;
  items: PosNewLineV2[];
};
export type PosUpdateV2 = {
  version: number;
  /** Legacy open orders remain editable; new creates cannot select legacy. */
  saleType: SaleType;
  orderLabel: string;
  locationId: string | null;
  tableId: string | null;
  note: string | null;
  items: (PosNewLineV2 | PosExistingLineV2)[];
};
/** No client tariff, discount amount, or editable bonus quantity is accepted. */
export type PosCouponRefV2 = {
  couponId: string;
  productId?: string | null;
  targetSourceLineId?: string;
};
export type PosCloseV2 = {
  clientRequestId: string;
  version: number;
  membershipId?: string;
  coupon?: PosCouponRefV2 | null;
  payments?: PaymentInput[];
};
export type PosVoidV2 = { version?: number };
export type PosResolveCommandV2 = {
  qrToken: string;
  locationId?: string | null;
};
export type PosCouponV2 = {
  couponId: string;
  label: string;
  kind:
    | "discount"
    | "free_product"
    | "two_for_one"
    | "custom"
    | "extra_stamps"
    | "extra_points";
  rule: string | null;
  productId: string | null;
  productName: string | null;
  discountUnit: "percent" | "amount" | null;
  discountValue: string | null;
  currencyCode: string | null;
  extraUnits: number | null;
  validUntil: string;
};
export type PosCouponStateV2 =
  | {
      status: "selected";
      coupon: PosCouponV2;
      verdict:
        { valid: true } | { valid: false; code: string; message: string };
    }
  | { status: "used_today"; label: string }
  | { status: "hint"; count: number }
  | { status: "none" };
export type PosResolveV2 = {
  consumer: { displayName: string };
  membership: {
    id: string;
    pointsBalance: number;
    stampsCount: number;
    justEnrolled: boolean;
  };
  program: {
    id: string;
    kind: string;
    accrual: {
      mode: string | null;
      grant: number | null;
      blockAmount: string | null;
    };
  };
  couponState: PosCouponStateV2;
};
export type PosConflictV2 =
  | { code: "version_conflict"; order: PosOrderV2 }
  | { code: "catalog_changed"; products: PosCatalogProductV2[] }
  | {
      code:
        | "backoffice_context_changed"
        | "pos_client_upgrade_required"
        | "create_request_reused"
        | "coupon_measure_not_supported";
    };

export type DeepReadonly<T> = T extends readonly (infer V)[]
  ? readonly DeepReadonly<V>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
export type FrozenPosCommand<T> = Readonly<{
  scopeKey: string;
  body: DeepReadonly<T>;
}>;
/** Copy before freezing: edits to the draft cannot alter an uncertain operation's replay. */
export function freezePosCommand<
  T extends PosCreateV2 | PosUpdateV2 | PosCloseV2 | PosResolveCommandV2,
>(scopeKey: string, body: T): FrozenPosCommand<T> {
  if (!scopeKey) throw new Error("backoffice_context_not_ready");
  const copy = structuredClone(body);
  function freeze(value: unknown): void {
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  }
  freeze(copy);
  return Object.freeze({ scopeKey, body: copy as DeepReadonly<T> });
}

export type ProductCouponLine = Pick<
  PosLineV2,
  "lineId" | "productId" | "quantity" | "measure"
>;
export type ProductCouponTarget =
  | { ok: true; targetSourceLineId: string }
  | {
      ok: false;
      status: 409;
      code:
        | "coupon_product_missing"
        | "coupon_measure_not_supported"
        | "coupon_quantity";
    };
/** Array is the server's stable line order. Shared by preview and authoritative close. */
export function selectProductCouponLine(
  kind: "free_product" | "two_for_one",
  items: readonly ProductCouponLine[],
  productId: string | null,
  targetSourceLineId?: string,
): ProductCouponTarget {
  const no = (
    code:
      | "coupon_product_missing"
      | "coupon_measure_not_supported"
      | "coupon_quantity",
  ): ProductCouponTarget => ({ ok: false, status: 409, code });
  const matching =
    productId === null
      ? []
      : items.filter((line) => line.productId === productId);
  const explicit = targetSourceLineId !== undefined;
  const unitLines = explicit
    ? []
    : matching.filter((item) => parseMeasure(item.measure).kind === "unit");
  const line = explicit
    ? matching.find((item) => item.lineId === targetSourceLineId)
    : unitLines.find(
        (item) =>
          kind === "free_product" ||
          BigInt(trustedUnitSnapshotQuantity(item.quantity)) >= 2n,
      );
  if (!line) {
    if (explicit || !matching.length) return no("coupon_product_missing");
    return no(
      unitLines.length ? "coupon_quantity" : "coupon_measure_not_supported",
    );
  }
  const measure = parseMeasure(line.measure);
  if (measure.kind === "mass") return no("coupon_measure_not_supported");
  const quantity = trustedUnitSnapshotQuantity(line.quantity);
  if (kind === "two_for_one" && BigInt(quantity) < 2n)
    return no("coupon_quantity");
  return { ok: true, targetSourceLineId: line.lineId };
}

/** Only draft additions with identical frozen commercial snapshots may combine.
 * Settled lines and orphan snapshots keep their own identity. Quantity is deliberately
 * excluded: changing it must never reprice the frozen snapshot.
 */
export function canCombinePosLines(a: PosLineV2, b: PosLineV2): boolean {
  if (
    !a.productId ||
    a.productId !== b.productId ||
    a.name !== b.name ||
    a.financialSnapshot ||
    b.financialSnapshot
  )
    return false;
  const left = parseMeasure(a.measure),
    right = parseMeasure(b.measure);
  return (
    (left.kind === "unit"
      ? trustedUnitSnapshotPrice(a.unitPrice)
      : parsePrice(a.unitPrice)) ===
      (right.kind === "unit"
        ? trustedUnitSnapshotPrice(b.unitPrice)
        : parsePrice(b.unitPrice)) &&
    left.kind === right.kind &&
    left.quantityUnit === right.quantityUnit &&
    left.priceUnit === right.priceUnit &&
    left.conversionVersion === right.conversionVersion
  );
}
