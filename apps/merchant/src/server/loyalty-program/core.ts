export type LoyaltyKind = "points" | "stamps" | "tiers" | "cashback";
export type ClauseInput = { templateId?: string; text?: string };
export type StampAction = "keep" | "replace" | "remove";
/** Normalized card design (Sellos only). Colors are `#RRGGBB` uppercase; a null
 * `backgroundColor2` means a solid background and forces a null `gradientAngle`. */
export type CardDesignInput = {
  backgroundColor: string;
  backgroundColor2: string | null;
  gradientAngle: number | null;
  borderColor: string;
};
/** Accrual mechanics (spec 0036). `blockAmount` is a `numeric(12,2)` string
 * (the catalog `unitPrice` convention); null iff `mode === "per_purchase"`. */
export type AccrualInput = {
  mode: "per_amount" | "per_purchase";
  grant: number; // integer > 0
  blockAmount: string | null; // > 0 if per_amount; null if per_purchase
};
/** A reward, form-validated. `label`/`productId` are only fully resolved for
 * `catalog_product` in `saveProgram` (ownership check + name snapshot against the DB). */
export type RewardInput = {
  type: "catalog_product" | "custom" | "discount";
  label: string;
  productId: string | null; // only catalog_product
  discountPercent: number | null; // only discount, 1..100
  pointsCost: number | null; // required (>0) for Puntos; null for Sellos
  position: number;
};
export type ProgramInput = {
  kind: LoyaltyKind;
  configuration: Record<string, unknown>;
  clauses: ClauseInput[];
  stampAction: StampAction;
  stampUploadId?: string;
  cardDesign: CardDesignInput | null;
  accrual: AccrualInput;
  rewards: RewardInput[];
};
export type CloseInput = {
  earningEndsAt?: unknown;
  redemptionEndsAt?: unknown;
};

export type EventAction =
  | "created"
  | "edited"
  | "closing_scheduled"
  | "closing_canceled"
  | "expired";

export class LoyaltyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
