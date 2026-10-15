import type { DbTransaction } from "@mi-pasaporte/db";
import type {
  FinancialSettlement,
  FinancialLine,
  FinancialPayment,
  FinancialPaymentOriginal,
  ExactAmount,
} from "@mi-pasaporte/domain/financial";
export type ResourceVersion = {
  providerId: string;
  slot: string;
  versionId: string;
};
export type SaleClosedEventV1 = {
  eventVersion: 1;
  sourceOrderId: string;
  locationId: string;
  closedAt: string;
  userId: string;
  lines: {
    sourceLineId: string;
    productId: string | null;
    quantity: number;
    resourceVersions: ResourceVersion[];
  }[];
};
export type PaymentMetadata = {
  paymentId: string;
  methodProviderId: string;
  methodId: string;
  methodName: string;
  chargeShape: "none" | "percent" | "fixed" | "percent_and_fixed";
};
export type SaleClosedEventV2 = Omit<
  SaleClosedEventV1,
  "eventVersion" | "lines"
> & {
  eventVersion: 2;
  money: {
    gross: string;
    discount: string;
    roundingAdjustment: string;
    collected: string;
    currencyCode: string;
    minorUnit: 0 | 2;
    originalGross: ExactAmount;
    originalDiscount: ExactAmount;
    originalNet: ExactAmount;
    normalizationAdjustments: FinancialSettlement["normalizationAdjustments"];
  };
  lines: (SaleClosedEventV1["lines"][number] & {
    position: number;
    money: FinancialLine["money"];
    discountOrigin: FinancialLine["discountOrigin"];
  })[];
  payments: (FinancialPayment &
    PaymentMetadata & { resourceVersions: ResourceVersion[] })[];
  paymentOriginals: FinancialPaymentOriginal[];
};
export type SaleClosedEvent = SaleClosedEventV1 | SaleClosedEventV2;
export type CapturedModuleEvent = {
  id: string;
  businessId: string;
  payload: SaleClosedEvent;
};
export type EventSubscription = {
  eventType: "sale.closed";
  resourceType: string;
  slot: string;
  requiredModules: readonly string[];
  handler: (tx: DbTransaction, event: CapturedModuleEvent) => Promise<void>;
};
