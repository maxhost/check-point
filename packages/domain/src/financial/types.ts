export type ExactAmount = { numerator: string; denominator: string; scale: 2 };
export type DiscountOrigin = {
  type: "campaign_coupon" | "program_reward";
  sourceId: string;
  campaignId?: string;
  benefitKind?: string;
  scope: "order" | "line";
  targetSourceLineId?: string;
};
export type FinancialOriginals = {
  gross: ExactAmount;
  discount: ExactAmount;
  net: ExactAmount;
};
export type FinancialLine = {
  sourceLineId: string;
  position: number;
  money: {
    gross: string;
    discount: string;
    net: string;
    roundingAdjustment: string;
    originals: FinancialOriginals;
    normalizationAdjustments: FinancialOriginals;
  };
  discountOrigin: DiscountOrigin | null;
};
export type FinancialPayment = {
  paymentId: string;
  position: number;
  methodId: string;
  amount: string;
  originalAmount: ExactAmount;
  normalizationAdjustment: ExactAmount;
};
export type FinancialPaymentOriginal = FinancialPayment & {
  effective: boolean;
};
export type FinancialAmounts = {
  gross: string;
  discount: string;
  roundingAdjustment: string;
  collected: string;
  currencyCode: string;
  minorUnit: 0 | 2;
  originals: FinancialOriginals;
  normalizationAdjustments: FinancialOriginals;
  lines: FinancialLine[];
};
export type FinancialSettlement = FinancialAmounts & {
  payments: FinancialPayment[];
  paymentOriginals: FinancialPaymentOriginal[];
};
export type FinancialInput = {
  currencyCode: string;
  lines: readonly {
    sourceLineId: string;
    position: number;
    unitPrice: string;
    quantity: number;
  }[];
  discount: { amount: string; origin: DiscountOrigin } | null;
};
export type PaymentInput = {
  paymentId: string;
  methodId: string;
  amount: string;
};
export class FinancialError extends Error {
  constructor(
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "FinancialError";
  }
}
