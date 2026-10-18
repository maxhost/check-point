import type { DbTransaction } from "@mi-pasaporte/db";
import type {
  FinancialSettlement,
  FinancialLine,
  FinancialPayment,
  FinancialPaymentOriginal,
  ExactAmount,
} from "@mi-pasaporte/domain/financial";
import type { Decimal, LineMeasure } from "@mi-pasaporte/domain/measures";
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
export type SaleClosedEventV3 = Omit<
  SaleClosedEventV2,
  "eventVersion" | "lines"
> & {
  eventVersion: 3;
  lines: (SaleClosedEventV2["lines"][number] & {
    productLabel: string;
    commissionMinor: string | null;
  })[];
};
export type SaleClosedEvent =
  SaleClosedEventV1 | SaleClosedEventV2 | SaleClosedEventV3;
/** Dormant measured contract; legacy subscribers keep SaleClosedEvent. */
export type SaleClosedEventV4 = Omit<
  SaleClosedEventV3,
  "eventVersion" | "lines"
> & {
  eventVersion: 4;
  lines: (Omit<SaleClosedEventV3["lines"][number], "quantity"> & {
    quantity: Decimal;
    measure: LineMeasure;
  })[];
};
/** Wire union: historical versions retain their original numeric quantities. */
export type MeasuredSaleClosedEvent = SaleClosedEvent | SaleClosedEventV4;
type MeasuredEventView<T extends MeasuredSaleClosedEvent> =
  T extends MeasuredSaleClosedEvent
    ? {
        payload: T;
        lines: (Omit<T["lines"][number], "quantity"> & {
          quantity: Decimal;
          measure: T extends SaleClosedEventV4
            ? LineMeasure
            : Extract<LineMeasure, { kind: "unit" }>;
        })[];
      }
    : never;
/** In-memory interpretation API, distinct from the durable wire contract. */
export type MeasuredSaleClosedEventView =
  MeasuredEventView<MeasuredSaleClosedEvent>;
export type CapturedModuleEvent = {
  id: string;
  businessId: string;
  payload: SaleClosedEvent;
};
export type SaleEventSubscription = {
  eventType: "sale.closed";
  resourceType: string;
  slot: string;
  requiredModules: readonly string[];
  handler: (tx: DbTransaction, event: CapturedModuleEvent) => Promise<void>;
};

export type GenericEventSubscription = {
  eventType: string;
  resourceType: string;
  slot: string;
  requiredModules: readonly string[];
  dispatch: (
    tx: DbTransaction,
    event: {
      id: string;
      businessId: string;
      eventVersion: number;
      payload: unknown;
    },
  ) => Promise<void>;
};
export type EventSubscription =
  SaleEventSubscription | GenericEventSubscription;
/** A producer/consumer-owned decoder keeps typed payloads outside the framework. */
export function defineEventSubscription<T>(
  args: Omit<GenericEventSubscription, "dispatch"> & {
    decode: (payload: unknown, version: number) => T;
    handler: (
      tx: DbTransaction,
      event: { id: string; businessId: string; payload: T },
    ) => Promise<void>;
  },
): GenericEventSubscription {
  return {
    ...args,
    dispatch: async (tx, event) =>
      args.handler(tx, {
        id: event.id,
        businessId: event.businessId,
        payload: args.decode(event.payload, event.eventVersion),
      }),
  };
}
