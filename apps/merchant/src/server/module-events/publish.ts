import { and, eq, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { moduleEvents, moduleResourceVersions } from "@mi-pasaporte/db/schema";
import { appendModuleEvent } from "./append";
import type {
  SaleClosedEvent,
  ResourceVersion,
  PaymentMetadata,
} from "./types";
import type { FinancialSettlement } from "@mi-pasaporte/domain/financial";
import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import { decodeSaleClosedEvent } from "./decode";
export async function setResourceVersion(
  tx: DbTransaction,
  args: {
    businessId: string;
    resourceType: string;
    resourceId: string;
    providerId: string;
    slot: string;
    versionId: string;
  },
) {
  await tx
    .insert(moduleResourceVersions)
    .values(args)
    .onConflictDoUpdate({
      target: [
        moduleResourceVersions.businessId,
        moduleResourceVersions.resourceType,
        moduleResourceVersions.resourceId,
        moduleResourceVersions.providerId,
        moduleResourceVersions.slot,
      ],
      set: { versionId: args.versionId, updatedAt: new Date() },
    });
}
/** Only core pointers/activation are read here; no module handler is called. */
export async function publishSaleClosed(
  tx: DbTransaction,
  args: {
    businessId: string;
    settlement?: FinancialSettlement;
    capture?: ResourceCapture;
    paymentsMetadata?: readonly PaymentMetadata[];
    sourceOrderId: string;
    locationId: string;
    closedAt: Date;
    userId: string;
    lines: {
      sourceLineId: string;
      productId: string | null;
      quantity: number;
    }[];
  },
) {
  if (process.env.MODULE_EVENTS_ENABLED !== "true") return null;
  if (
    args.lines.some(
      (l) => !Number.isSafeInteger(l.quantity) || l.quantity <= 0,
    ) ||
    new Set(args.lines.map((l) => l.sourceLineId)).size !== args.lines.length
  )
    throw new Error("Invalid event lines");
  const [existing] = await tx
    .select({ id: moduleEvents.id })
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, args.businessId),
        eq(moduleEvents.eventType, "sale.closed"),
        eq(moduleEvents.sourceId, args.sourceOrderId),
      ),
    )
    .limit(1);
  if (existing) {
    const [event] = await tx
      .select({ payload: moduleEvents.payload })
      .from(moduleEvents)
      .where(eq(moduleEvents.id, existing.id));
    return {
      eventId: existing.id,
      closedAt: new Date((event.payload as SaleClosedEvent).closedAt),
    };
  }
  const row = args.capture ?? (await captureSaleResources(tx, args));
  const refs = (resourceType: string, resourceId: string | null) =>
    row.versions
      .filter(
        (v) => v.resourceType === resourceType && v.resourceId === resourceId,
      )
      .map(({ providerId, slot, versionId }) => ({
        providerId,
        slot,
        versionId,
      }));
  const common = {
    sourceOrderId: args.sourceOrderId,
    locationId: args.locationId,
    closedAt: new Date(row.captured_at).toISOString(),
    userId: args.userId,
    lines: args.lines.map((l) => ({
      ...l,
      resourceVersions: refs("product", l.productId),
    })),
  };
  const financial = args.settlement;
  let payload: SaleClosedEvent = { eventVersion: 1, ...common };
  if (financial) {
    assertFinancialSettlement(financial);
    if (financial.lines.length !== common.lines.length)
      throw new Error("Invalid financial event lines");
    payload = {
      ...common,
      eventVersion: 2,
      money: {
        gross: financial.gross,
        discount: financial.discount,
        roundingAdjustment: financial.roundingAdjustment,
        collected: financial.collected,
        currencyCode: financial.currencyCode,
        minorUnit: financial.minorUnit,
        originalGross: financial.originals.gross,
        originalDiscount: financial.originals.discount,
        originalNet: financial.originals.net,
        normalizationAdjustments: financial.normalizationAdjustments,
      },
      lines: financial.lines.map((frozen) => {
        const line = common.lines.find(
          (l) => l.sourceLineId === frozen.sourceLineId,
        );
        if (!line) throw new Error("Missing financial line");
        return {
          ...line,
          position: frozen.position,
          money: frozen.money,
          discountOrigin: frozen.discountOrigin,
        };
      }),
      payments: financial.payments.map((payment) => {
        const metadata = args.paymentsMetadata?.find(
          (m) =>
            m.paymentId === payment.paymentId &&
            m.methodId === payment.methodId,
        );
        if (!metadata || !metadata.methodProviderId || !metadata.methodName)
          throw new Error("Missing payment metadata");
        return {
          ...payment,
          ...metadata,
          resourceVersions: refs("payment_method", payment.methodId),
        };
      }),
      paymentOriginals: financial.paymentOriginals,
    };
  }
  decodeSaleClosedEvent(payload);
  const { eventId } = await appendModuleEvent(tx, {
    businessId: args.businessId,
    eventType: "sale.closed",
    eventVersion: payload.eventVersion,
    sourceId: args.sourceOrderId,
    locationId: args.locationId,
    payload,
    enabledModuleIds: row.enabled,
  });
  return { eventId, closedAt: new Date(payload.closedAt) };
}

export type ResourceCapture = {
  captured_at: Date | string;
  versions: (ResourceVersion & { resourceType: string; resourceId: string })[];
  enabled: string[];
};
export async function captureSaleResources(
  tx: DbTransaction,
  args: {
    businessId: string;
    lines: readonly { productId: string | null }[];
    settlement?: FinancialSettlement;
  },
): Promise<ResourceCapture> {
  const resources = [
    ...new Map(
      [
        ...args.lines.flatMap((l) =>
          l.productId
            ? [{ resourceType: "product", resourceId: l.productId }]
            : [],
        ),
        ...(args.settlement?.payments.map((p) => ({
          resourceType: "payment_method",
          resourceId: p.methodId,
        })) ?? []),
      ].map((r) => [r.resourceType + "/" + r.resourceId, r]),
    ).values(),
  ];
  // All typed resource pointers and subscriber eligibility share one MVCC visibility point.
  const resourceValues = resources.length
    ? sql`values ${sql.join(
        resources.map(
          (r) => sql`(${r.resourceType}::text,${r.resourceId}::uuid)`,
        ),
        sql`,`,
      )}`
    : sql`select null::text,null::uuid where false`;
  const capture = await tx.execute(sql`select clock_timestamp() as captured_at,
  (select coalesce(jsonb_agg(jsonb_build_object('resourceType',p.resource_type,'resourceId',p.resource_id,'providerId',p.provider_id,'slot',p.slot,'versionId',p.version_id)),'[]'::jsonb) from core.module_resource_version p join (${resourceValues}) r(resource_type,resource_id) on r.resource_type=p.resource_type and r.resource_id=p.resource_id where p.business_id=${args.businessId}::uuid) as versions,
  (select coalesce(jsonb_agg(module_id),'[]'::jsonb) from core.business_module where business_id=${args.businessId}::uuid and enabled=true) as enabled`);
  return capture.rows[0] as unknown as ResourceCapture;
}
