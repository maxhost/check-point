import type { DbTransaction } from "@mi-pasaporte/db";
export type ResourceVersion = {
  providerId: string;
  slot: string;
  versionId: string;
};
export type SaleClosedEvent = {
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
export type CapturedModuleEvent = {
  id: string;
  businessId: string;
  payload: SaleClosedEvent;
};
export type EventSubscription = {
  eventType: "sale.closed";
  resourceType: "product";
  slot: string;
  requiredModules: readonly string[];
  handler: (tx: DbTransaction, event: CapturedModuleEvent) => Promise<void>;
};
