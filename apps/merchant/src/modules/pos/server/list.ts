import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  orders,
  posOrderItems,
  posOrders,
} from "@mi-pasaporte/db/schema";
import { unitPriceOf } from "./lines";
import {
  EMPTY_SUMMARY,
  measuredSummaryColumns,
  summaryAmounts,
  frozenSummaryTotals,
  upgradeRequired,
} from "./measured-summary";

/**
 * Spec 0169 §Contrato — `GET /api/modules/pos/orders`: el historial del POS (owner: «Abiertas» de
 * cualquier fecha y «Cerradas hoy»).
 *
 * - `open`: todas las abiertas del negocio, **las mas viejas primero** (la mesa que espera hace
 *   mas tiempo arriba).
 * - `closedToday`: cerradas Y anuladas cuyo `closed_at` cae en el dia LOCAL del negocio (misma
 *   nocion de dia que el historial del mostrador, `history.ts`), las mas recientes primero.
 *
 * `itemCount` es la suma de las CANTIDADES (2 cafes + 1 medialuna = 3), no la cantidad de
 * lineas. `saleTotal` es el neto cobrado de la `core.order` enlazada (solo cerrada con pase).
 */
export type PosOrderSummary = {
  id: string;
  status: "open" | "closed" | "voided";
  tableLabel: string;
  tableId: string | null;
  location: { id: string; name: string } | null;
  total: string;
  itemCount: number;
  createdAt: string;
  closedAt: string | null;
  saleTotal: string | null;
};

export type PosSummaryV2 = Omit<PosOrderSummary, "tableLabel" | "itemCount"> & {
  version: number;
  saleType: "table" | "pickup" | "delivery" | "counter" | "legacy";
  orderLabel: string;
  lineCount: number;
};
type PosList<T> = { open: T[]; closedToday: T[] };

const summaryColumns = {
  id: posOrders.id,
  status: posOrders.status,
  tableLabel: posOrders.tableLabel,
  version: posOrders.version,
  saleType: posOrders.saleType,
  totalSnapshot: posOrders.totalSnapshot,
  hasSettlement: sql<boolean>`${posOrders.settlement} is not null`,
  settlementGross: sql<string | null>`${posOrders.settlement}->>'gross'`,
  settlementCollected: sql<
    string | null
  >`${posOrders.settlement}->>'collected'`,
  settlementCurrency: sql<
    string | null
  >`${posOrders.settlement}->>'currencyCode'`,
  tableId: posOrders.diningTableId,
  locationId: locations.id,
  locationName: locations.name,
  createdAt: posOrders.createdAt,
  closedAt: posOrders.closedAt,
  saleTotal: orders.total,
};

/** Default/three-argument caller remains V1. V2 wiring belongs to the API assembly. */
export function listPosOrders(
  businessId: string,
  now?: Date,
  status?: "voided",
  version?: 1,
): Promise<PosList<PosOrderSummary>>;
export function listPosOrders(
  businessId: string,
  now: Date | undefined,
  status: "voided" | undefined,
  version: 2,
): Promise<PosList<PosSummaryV2>>;
export async function listPosOrders(
  businessId: string,
  now: Date = new Date(),
  status?: "voided",
  version: 1 | 2 = 1,
): Promise<PosList<PosOrderSummary | PosSummaryV2>> {
  const db = getDb();
  const [business] = await db
    .select({
      timezone: businesses.timezone,
      currencyCode: businesses.currencyCode,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  const timezone = business?.timezone ?? "UTC";

  const openPredicate =
    status === "voided" ? sql`false` : eq(posOrders.status, "open");
  const closedPredicate = and(
    status === "voided"
      ? eq(posOrders.status, "voided")
      : inArray(posOrders.status, ["closed", "voided"]),
    status === "voided"
      ? sql`${posOrders.closedAt} >= ${now.toISOString()}::timestamptz - interval '90 days' AND ${posOrders.closedAt} <= ${now.toISOString()}::timestamptz`
      : sql`(${posOrders.closedAt} AT TIME ZONE ${timezone})::date = (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::date`,
  );
  const aggregates = db
    .select({
      posOrderId: posOrderItems.posOrderId,
      ...measuredSummaryColumns({
        quantity: posOrderItems.quantity,
        price: posOrderItems.unitPriceSnapshot,
        kind: posOrderItems.measureKind,
        quantityUnit: posOrderItems.quantityUnit,
        priceUnit: posOrderItems.priceUnit,
        conversionVersion: posOrderItems.conversionVersion,
      }),
    })
    .from(posOrderItems)
    .innerJoin(posOrders, eq(posOrders.id, posOrderItems.posOrderId))
    .where(
      and(
        eq(posOrders.businessId, businessId),
        or(openPredicate, closedPredicate),
      ),
    )
    .groupBy(posOrderItems.posOrderId)
    .as("summary_amounts");
  const base = () =>
    db
      .select({
        ...summaryColumns,
        amounts: {
          lineCount: aggregates.lineCount,
          numerator: aggregates.numerator,
          maxNumerator: aggregates.maxNumerator,
          invalid: aggregates.invalid,
          incompatible: aggregates.incompatible,
          unitCount: aggregates.unitCount,
        },
      })
      .from(posOrders)
      .leftJoin(aggregates, eq(aggregates.posOrderId, posOrders.id))
      .leftJoin(locations, eq(locations.id, posOrders.locationId))
      .leftJoin(
        orders,
        and(
          eq(orders.id, posOrders.orderId),
          eq(orders.businessId, businessId),
        ),
      );

  const open = await base()
    .where(and(eq(posOrders.businessId, businessId), openPredicate))
    .orderBy(asc(posOrders.createdAt));
  const closedToday = await base()
    .where(and(eq(posOrders.businessId, businessId), closedPredicate))
    .orderBy(desc(posOrders.closedAt));

  const toSummary = (
    row: (typeof open)[number],
  ): PosOrderSummary | PosSummaryV2 => {
    const aggregate =
      row.amounts?.lineCount === null
        ? EMPTY_SUMMARY
        : (row.amounts ?? EMPTY_SUMMARY);
    // Select scalar frozen amounts only: settlement contains per-line JSON we do not need.
    if (
      row.hasSettlement &&
      (!row.settlementGross ||
        !row.settlementCollected ||
        !row.settlementCurrency)
    )
      upgradeRequired();
    const settlement = row.hasSettlement
      ? {
          gross: row.settlementGross!,
          collected: row.settlementCollected!,
          currencyCode: row.settlementCurrency!,
        }
      : null;
    // Only compatible unit snapshots can supply historical cents without a frozen amount.
    if (
      row.status !== "open" &&
      !settlement &&
      row.saleTotal === null &&
      row.totalSnapshot === null &&
      aggregate.incompatible
    )
      upgradeRequired();
    // Closed values use their own frozen currency; legacy snapshots keep historical cents.
    const amounts = summaryAmounts(
      aggregate,
      row.status === "open"
        ? (business?.currencyCode ?? "USD")
        : (settlement?.currencyCode ?? "USD"),
      version,
    );
    const frozen = frozenSummaryTotals(
      {
        status: row.status as PosOrderSummary["status"],
        settlement,
        coreNet: row.saleTotal,
        totalSnapshot: row.totalSnapshot,
        legacyGross: amounts.total,
      },
      version,
    );
    const total = row.status === "open" ? amounts.total : frozen.total;
    const net = frozen.saleTotal;
    const common = {
      id: row.id,
      status: row.status as PosOrderSummary["status"],
      tableId: row.tableId,
      location:
        row.locationId && row.locationName !== null
          ? { id: row.locationId, name: row.locationName }
          : null,
      total: version === 1 ? unitPriceOf(total) : total,
      createdAt: row.createdAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      saleTotal: net === null ? null : version === 1 ? unitPriceOf(net) : net,
    };
    if (version === 1)
      return {
        ...common,
        tableLabel: row.tableLabel,
        itemCount: amounts.itemCount,
      };
    const saleType =
      row.saleType ?? (row.tableId === null ? "legacy" : "table");
    if (
      !["table", "pickup", "delivery", "counter", "legacy"].includes(saleType)
    )
      upgradeRequired();
    return {
      ...common,
      version: row.version,
      saleType: saleType as PosSummaryV2["saleType"],
      orderLabel: row.tableLabel,
      lineCount: amounts.lineCount,
    };
  };
  return { open: open.map(toSummary), closedToday: closedToday.map(toSummary) };
}
