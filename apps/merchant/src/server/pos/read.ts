import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  consumerAccounts,
  locations,
  orders,
  posOrderItems,
  posOrders,
  users,
} from "@mi-pasaporte/db/schema";
import { readOrderByRequest } from "../counter/orders";
import { toResult } from "../counter/grant";
import { lineTotalOf, totalOf } from "./lines";
import { unknownPosOrder } from "./errors";

/**
 * Spec 0169 §Contrato — `PosOrder`, la forma que devuelven crear/leer/editar/anular/cerrar. Lo
 * impreso sale de aca (comercio, local, mesa, lineas, total; cerrada con pase: el neto y el
 * cupon). Dinero como string `"12.50"`. Ninguna clave interna (`close_request_id`, ids de
 * consumidor o membresia) viaja.
 */
export type PosOrderItemDTO = {
  lineId: string;
  productId: string | null;
  name: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};

export type PosSaleDTO = {
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

export type PosOrderDTO = {
  id: string;
  status: "open" | "closed" | "voided";
  version: number;
  tableLabel: string;
  location: { id: string; name: string } | null;
  business: { name: string; currencyCode: string };
  items: PosOrderItemDTO[];
  total: string;
  createdAt: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string | null;
  sale: PosSaleDTO | null;
};

const creator = alias(users, "pos_creator");
const closer = alias(users, "pos_closer");

/** El nombre del operador como lo muestra el historial del mostrador (`history.ts`). */
function operatorName(name: string | null, email: string | null): string {
  return name?.trim() || email || "";
}

/** La venta de una orden cerrada CON pase: la `core.order` enlazada, releida por su clave de
 * idempotencia (`readOrderByRequest`, la misma lectura del reintento del mostrador). */
async function readSale(
  businessId: string,
  orderId: string,
  closeRequestId: string,
): Promise<PosSaleDTO | null> {
  const granted = await readOrderByRequest(businessId, closeRequestId);
  if (!granted || granted.id !== orderId) return null;
  const [who] = await getDb()
    .select({
      firstName: consumerAccounts.firstName,
      lastName: consumerAccounts.lastName,
    })
    .from(orders)
    .innerJoin(consumerAccounts, eq(consumerAccounts.id, orders.consumerId))
    .where(eq(orders.id, orderId))
    .limit(1);
  const { order } = toResult(granted);
  return {
    consumer: `${who?.firstName ?? ""} ${who?.lastName ?? ""}`.trim(),
    total: order.total,
    grossTotal: order.grossTotal,
    unitsGranted: order.unitsGranted,
    balanceAfter: order.balanceAfter,
    kind: order.kind === "stamps" ? "stamps" : "points",
    coupon: order.coupon,
  };
}

/** Una orden del negocio, o `null` si no existe o es de OTRO negocio (la ruta lo vuelve 404). */
export async function readPosOrder(
  businessId: string,
  id: string,
): Promise<PosOrderDTO | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: posOrders.id,
      status: posOrders.status,
      version: posOrders.version,
      tableLabel: posOrders.tableLabel,
      locationId: locations.id,
      locationName: locations.name,
      businessName: businesses.name,
      currencyCode: businesses.currencyCode,
      createdAt: posOrders.createdAt,
      closedAt: posOrders.closedAt,
      orderId: posOrders.orderId,
      closeRequestId: posOrders.closeRequestId,
      creatorName: creator.name,
      creatorEmail: creator.email,
      closerName: closer.name,
      closerEmail: closer.email,
    })
    .from(posOrders)
    .innerJoin(businesses, eq(businesses.id, posOrders.businessId))
    .leftJoin(locations, eq(locations.id, posOrders.locationId))
    .innerJoin(creator, eq(creator.id, posOrders.createdByUserId))
    .leftJoin(closer, eq(closer.id, posOrders.closedByUserId))
    .where(and(eq(posOrders.id, id), eq(posOrders.businessId, businessId)))
    .limit(1);
  if (!row) return null;

  const lines = await db
    .select({
      id: posOrderItems.id,
      productId: posOrderItems.productId,
      name: posOrderItems.nameSnapshot,
      unitPrice: posOrderItems.unitPriceSnapshot,
      quantity: posOrderItems.quantity,
    })
    .from(posOrderItems)
    .where(eq(posOrderItems.posOrderId, id))
    .orderBy(asc(posOrderItems.position), asc(posOrderItems.id));

  const items = lines.map((line) => ({
    lineId: line.id,
    productId: line.productId,
    name: line.name,
    unitPrice: Number(line.unitPrice).toFixed(2),
    quantity: line.quantity,
    lineTotal: lineTotalOf(line.unitPrice, line.quantity),
  }));

  return {
    id: row.id,
    status: row.status as PosOrderDTO["status"],
    version: row.version,
    tableLabel: row.tableLabel,
    location:
      row.locationId && row.locationName !== null
        ? { id: row.locationId, name: row.locationName }
        : null,
    business: { name: row.businessName, currencyCode: row.currencyCode },
    items,
    total: totalOf(items),
    createdAt: row.createdAt.toISOString(),
    createdBy: operatorName(row.creatorName, row.creatorEmail),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closedBy: row.closedAt
      ? operatorName(row.closerName, row.closerEmail)
      : null,
    sale:
      row.orderId && row.closeRequestId
        ? await readSale(businessId, row.orderId, row.closeRequestId)
        : null,
  };
}

/** {@link readPosOrder} o 404 `unknown_pos_order`. */
export async function getPosOrder(
  businessId: string,
  id: string,
): Promise<PosOrderDTO> {
  const order = await readPosOrder(businessId, id);
  if (!order) throw unknownPosOrder();
  return order;
}
