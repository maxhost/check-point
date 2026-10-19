import type {
  FinancialSettlement,
  FinancialLine,
} from "@mi-pasaporte/domain/financial";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  consumerAccounts,
  locations,
  moduleEvents,
  orders,
  posOrderItems,
  posOrders,
  users,
} from "@mi-pasaporte/db/schema";
import { readOrderByRequest } from "../../../server/counter/orders";
import {
  add,
  originalMoney,
  formatMinor,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import {
  assertLegacySnapshot,
  measuredItems,
  measuredTotal,
  persistedSaleType,
} from "./measured-read";
import type { PosOrderV2 } from "../contracts";
import { lineTotalOf, totalOf, unitQuantityOf, unitPriceOf } from "./lines";
import { unknownPosOrder } from "./errors";
import {
  frozenVoidFromRow,
  voidSnapshotColumns,
  voidSnapshotJoin,
} from "./void-snapshot";

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
  financialSnapshot: FinancialLine | null;
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
  /** Spec 0182: la mesa elegida, o null con texto libre. */
  tableId: string | null;
  location: { id: string; name: string } | null;
  /** La nota libre de la orden, o null. */
  note: string | null;
  business: { name: string; currencyCode: string };
  items: PosOrderItemDTO[];
  total: string;
  createdAt: string;
  createdBy: string;
  closedAt: string | null;
  closedBy: string | null;
  sale: PosSaleDTO | null;
  settlement: FinancialSettlement | null;
};

const creator = alias(users, "pos_creator");
const closer = alias(users, "pos_closer");

/** El nombre del operador como lo muestra el historial del mostrador (`history.ts`). */
function operatorName(name: string | null, email: string | null): string {
  return name?.trim() || email || "";
}

/** La venta de una orden cerrada CON pase: la `core.order` enlazada, releida por su clave de
 * idempotencia (`readOrderByRequest`, la misma lectura del reintento del mostrador). */
export async function readSale(
  businessId: string,
  orderId: string,
  closeRequestId: string,
  settlement: FinancialSettlement | null,
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
  const order = {
    ...granted,
    kind: granted.accrualKind,
    grossTotal: formatMinor(
      toMinor(
        add(
          originalMoney(granted.total),
          originalMoney(granted.coupon?.discountAmount ?? "0.00"),
        ),
        2,
      ),
      2,
    ),
  };
  return {
    consumer: `${who?.firstName ?? ""} ${who?.lastName ?? ""}`.trim(),
    total: settlement?.collected ?? order.total,
    grossTotal: settlement?.gross ?? order.grossTotal,
    unitsGranted: order.unitsGranted,
    balanceAfter: order.balanceAfter,
    kind: order.kind === "stamps" ? "stamps" : "points",
    coupon: order.coupon
      ? {
          ...order.coupon,
          discountAmount: settlement?.discount ?? order.coupon.discountAmount,
        }
      : null,
  };
}

/** Una orden del negocio, o `null` si no existe o es de OTRO negocio (la ruta lo vuelve 404). */
export async function readPosOrder(
  businessId: string,
  id: string,
): Promise<PosOrderDTO | null>;
export async function readPosOrder(
  businessId: string,
  id: string,
  contract: 2,
): Promise<PosOrderV2 | null>;
export async function readPosOrder(
  businessId: string,
  id: string,
  contract?: 2,
): Promise<PosOrderDTO | PosOrderV2 | null> {
  const db = getDb();
  const [row] = await db
    .select({
      ...voidSnapshotColumns,
      id: posOrders.id,
      status: posOrders.status,
      version: posOrders.version,
      tableLabel: posOrders.tableLabel,
      saleType: posOrders.saleType,
      tableId: posOrders.diningTableId,
      note: posOrders.note,
      locationId: locations.id,
      locationName: locations.name,
      businessName: businesses.name,
      currencyCode: businesses.currencyCode,
      createdAt: posOrders.createdAt,
      closedAt: posOrders.closedAt,
      orderId: posOrders.orderId,
      closeRequestId: posOrders.closeRequestId,
      settlement: posOrders.settlement,
      creatorName: creator.name,
      creatorEmail: creator.email,
      closerName: closer.name,
      closerEmail: closer.email,
    })
    .from(posOrders)
    .leftJoin(moduleEvents, voidSnapshotJoin)
    .innerJoin(businesses, eq(businesses.id, posOrders.businessId))
    .leftJoin(locations, eq(locations.id, posOrders.locationId))
    .innerJoin(creator, eq(creator.id, posOrders.createdByUserId))
    .leftJoin(closer, eq(closer.id, posOrders.closedByUserId))
    .where(and(eq(posOrders.id, id), eq(posOrders.businessId, businessId)))
    .limit(1);
  if (!row) return null;
  const frozenVoid = frozenVoidFromRow(row);

  const lines = await db
    .select({
      id: posOrderItems.id,
      productId: posOrderItems.productId,
      name: posOrderItems.nameSnapshot,
      unitPrice: posOrderItems.unitPriceSnapshot,
      quantity: posOrderItems.quantity,
      financialSnapshot: posOrderItems.financialSnapshot,
      position: posOrderItems.position,
      measureKind: posOrderItems.measureKind,
      quantityUnit: posOrderItems.quantityUnit,
      priceUnit: posOrderItems.priceUnit,
      conversionVersion: posOrderItems.conversionVersion,
    })
    .from(posOrderItems)
    .where(eq(posOrderItems.posOrderId, id))
    .orderBy(asc(posOrderItems.position), asc(posOrderItems.id));

  if (contract !== 2) lines.forEach(assertLegacySnapshot);
  const items =
    contract === 2
      ? measuredItems(
          lines,
          row.settlement?.currencyCode ??
            frozenVoid?.currencyCode ??
            row.currencyCode,
          row.status !== "open",
          row.settlement,
        )
      : lines.map((line) => ({
          lineId: line.id,
          productId: line.productId,
          name: line.name,
          unitPrice: unitPriceOf(line.unitPrice),
          quantity: unitQuantityOf(line.quantity),
          lineTotal:
            line.financialSnapshot?.money.gross ??
            lineTotalOf(line.unitPrice, line.quantity),
          financialSnapshot: line.financialSnapshot,
        }));

  const result = {
    id: row.id,
    status: row.status as PosOrderDTO["status"],
    version: row.version,
    tableLabel: row.tableLabel,
    tableId: row.tableId,
    location:
      row.locationId && row.locationName !== null
        ? { id: row.locationId, name: row.locationName }
        : null,
    note: row.note,
    business: {
      name: row.businessName,
      currencyCode:
        row.settlement?.currencyCode ??
        frozenVoid?.currencyCode ??
        row.currencyCode,
    },
    items,
    total:
      frozenVoid?.gross ??
      row.settlement?.gross ??
      (contract === 2
        ? measuredTotal(items, row.currencyCode, row.status !== "open")
        : totalOf(items)),
    settlement: row.settlement,
    createdAt: row.createdAt.toISOString(),
    createdBy: operatorName(row.creatorName, row.creatorEmail),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closedBy: row.closedAt
      ? operatorName(row.closerName, row.closerEmail)
      : null,
    sale:
      row.orderId && row.closeRequestId
        ? await readSale(
            businessId,
            row.orderId,
            row.closeRequestId,
            row.settlement,
          )
        : null,
  };
  return contract === 2
    ? {
        ...result,
        contractVersion: 2,
        saleType: persistedSaleType(row.saleType, row.tableId),
        orderLabel: row.tableLabel,
        items: items as PosOrderV2["items"],
      }
    : { ...result, items: items as PosOrderDTO["items"] };
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

export async function getPosOrderV2(
  businessId: string,
  id: string,
): Promise<PosOrderV2> {
  const order = await readPosOrder(businessId, id, 2);
  if (!order) throw unknownPosOrder();
  return order;
}
