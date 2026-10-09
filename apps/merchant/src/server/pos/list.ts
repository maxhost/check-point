import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  orders,
  posOrderItems,
  posOrders,
} from "@mi-pasaporte/db/schema";
import { totalOf } from "./lines";

/**
 * Spec 0169 §Contrato — `GET /api/pos/orders`: el historial del POS (owner: «Abiertas» de
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

const summaryColumns = {
  id: posOrders.id,
  status: posOrders.status,
  tableLabel: posOrders.tableLabel,
  tableId: posOrders.diningTableId,
  locationId: locations.id,
  locationName: locations.name,
  createdAt: posOrders.createdAt,
  closedAt: posOrders.closedAt,
  saleTotal: orders.total,
};

export async function listPosOrders(
  businessId: string,
  now: Date = new Date(),
): Promise<{ open: PosOrderSummary[]; closedToday: PosOrderSummary[] }> {
  const db = getDb();
  const [business] = await db
    .select({ timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  const timezone = business?.timezone ?? "UTC";

  const base = () =>
    db
      .select(summaryColumns)
      .from(posOrders)
      .leftJoin(locations, eq(locations.id, posOrders.locationId))
      .leftJoin(orders, eq(orders.id, posOrders.orderId));

  const open = await base()
    .where(
      and(eq(posOrders.businessId, businessId), eq(posOrders.status, "open")),
    )
    .orderBy(asc(posOrders.createdAt));
  const closedToday = await base()
    .where(
      and(
        eq(posOrders.businessId, businessId),
        inArray(posOrders.status, ["closed", "voided"]),
        sql`(${posOrders.closedAt} AT TIME ZONE ${timezone})::date = (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::date`,
      ),
    )
    .orderBy(desc(posOrders.closedAt));

  const ids = [...open, ...closedToday].map((row) => row.id);
  const lines = ids.length
    ? await db
        .select({
          posOrderId: posOrderItems.posOrderId,
          unitPrice: posOrderItems.unitPriceSnapshot,
          quantity: posOrderItems.quantity,
        })
        .from(posOrderItems)
        .where(inArray(posOrderItems.posOrderId, ids))
    : [];
  const byOrder = new Map<string, { unitPrice: string; quantity: number }[]>();
  for (const line of lines) {
    const list = byOrder.get(line.posOrderId) ?? [];
    list.push(line);
    byOrder.set(line.posOrderId, list);
  }

  const toSummary = (row: (typeof open)[number]): PosOrderSummary => {
    const own = byOrder.get(row.id) ?? [];
    return {
      id: row.id,
      status: row.status as PosOrderSummary["status"],
      tableLabel: row.tableLabel,
      tableId: row.tableId,
      location:
        row.locationId && row.locationName !== null
          ? { id: row.locationId, name: row.locationName }
          : null,
      total: totalOf(own),
      itemCount: own.reduce((sum, line) => sum + line.quantity, 0),
      createdAt: row.createdAt.toISOString(),
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      saleTotal:
        row.saleTotal === null ? null : Number(row.saleTotal).toFixed(2),
    };
  };
  return { open: open.map(toSummary), closedToday: closedToday.map(toSummary) };
}
