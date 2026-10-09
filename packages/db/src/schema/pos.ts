import {
  check,
  index,
  integer,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";
import { businesses, locations } from "./business";
import { diningTables } from "./dining-table";
import { products } from "./catalog";
import { orders } from "./order";

/**
 * Spec 0169 / ADR 0130 — LA ORDEN ABIERTA DE UNA MESA DEL POS. Vive aparte de `core.order`, que
 * sigue siendo el registro inmutable de cada acreditacion: una orden del POS no tiene cliente,
 * cambia mientras dura la atencion y puede no acreditar nunca.
 *
 * - `status`: `open` (editable) → `closed` (cobrada) o `voided` (anulada). Nunca vuelve a `open`.
 * - `version`: lock optimista de la edicion; sube en cada `PUT`.
 * - `order_id`: la `core.order` que creo el cierre CON pase (unica); null si se cerro sin pase.
 * - `close_request_id`: la idempotencia del cierre (unico por negocio).
 *
 * El total no se guarda: se calcula al leer, linea por linea, con el mismo calculo que
 * `buildDetailed` (`server/pos/lines.ts`).
 */
export const posOrders = core.table(
  "pos_order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    tableLabel: text("table_label").notNull(),
    /** Spec 0182: la mesa elegida, o null con texto libre. Con mesa, `table_label` es la foto
     * de su nombre. */
    diningTableId: uuid("dining_table_id").references(() => diningTables.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("open"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    /** Quien cerro o anulo. */
    closedByUserId: text("closed_by_user_id").references(() => users.id),
    /** Cierre o anulacion. */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    orderId: uuid("order_id").references(() => orders.id),
    closeRequestId: uuid("close_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "core_pos_order_status_check",
      sql`${table.status} in ('open', 'closed', 'voided')`,
    ),
    check("core_pos_order_version_check", sql`${table.version} >= 1`),
    check(
      "core_pos_order_table_label_check",
      sql`char_length(${table.tableLabel}) between 1 and 60`,
    ),
    check(
      "core_pos_order_open_check",
      sql`(${table.status} = 'open') = (${table.closedAt} is null and ${table.closedByUserId} is null and ${table.closeRequestId} is null)`,
    ),
    check(
      "core_pos_order_order_closed_check",
      sql`${table.orderId} is null or ${table.status} = 'closed'`,
    ),
    uniqueIndex("core_pos_order_order_unique").on(table.orderId),
    uniqueIndex("core_pos_order_close_request_unique").on(
      table.businessId,
      table.closeRequestId,
    ),
    // Spec 0182: una sola orden abierta por mesa (owner 2026-10-08).
    uniqueIndex("core_pos_order_open_table_unique")
      .on(table.diningTableId)
      .where(sql`${table.status} = 'open'`),
    index("core_pos_order_business_status_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
    ),
  ],
);

/**
 * Una linea de una orden del POS. Snapshot de nombre y precio AL AGREGARLA (ADR 0130 §2: el
 * precio queda fijo): editar la orden conserva el snapshot de las lineas existentes.
 * `product_id` null + `on delete set null`: la linea sobrevive al producto borrado.
 */
export const posOrderItems = core.table(
  "pos_order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    posOrderId: uuid("pos_order_id")
      .notNull()
      .references(() => posOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceSnapshot: numeric("unit_price_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    quantity: integer("quantity").notNull(),
    /** Orden de carga de la linea. */
    position: integer("position").notNull(),
  },
  (table) => [
    check(
      "core_pos_order_item_price_check",
      sql`${table.unitPriceSnapshot} >= 0`,
    ),
    check("core_pos_order_item_quantity_check", sql`${table.quantity} > 0`),
    index("core_pos_order_item_order_idx").on(table.posOrderId),
  ],
);
