import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "../auth";
import { businesses, locations } from "../business";
import { products } from "../catalog";
import { orders } from "../order";
import { paymentMethods } from "../payment-methods";
import { createPosPaymentTables } from "./pos-payments";
import type {
  FinancialSettlement,
  FinancialLine,
} from "../../../../domain/src/financial/types";

/**
 * Spec 0220 / ADR 0141 §6 — EL MODULO POS (y Mesas) en su propio esquema Postgres. Las cuatro tablas
 * vivian en `core` (specs 0169, 0182, 0184) y la migracion 0079 las muda con `SET SCHEMA`: conservan
 * filas, FKs, indices y constraints, que siguen llamandose `core_pos_*` / `core_dining_table_*`
 * (renombrarlos es cosmetico, fuera de alcance). Claves foraneas solo modulo → core; ningun archivo
 * del core importa de aca (`modules-boundary.test.ts`) y ninguna FK del core apunta aca
 * (`modules-fk.neon.integration.test.ts`).
 *
 * `dining_table` es dato del POS (selector, ocupacion) y la administra el modulo Mesas, que requiere
 * el POS y por eso puede importarla.
 */
export const posSchema = pgSchema("pos");

/**
 * Spec 0182 / ADR 0131 — UNA MESA DE UN LOCAL. Nunca se borra: se archiva, como el local, para
 * que ninguna orden del POS (ni una reserva futura) quede apuntando a algo que no existe.
 *
 * - `name`: unico sin mayusculas entre las ACTIVAS del mismo local (una archivada no bloquea).
 * - `seats`: opcional (owner 2026-10-08: una «Barra» sin plazas).
 * - La ocupacion NO vive aca: es el unico parcial de `pos_order (dining_table_id) WHERE open`.
 */
export const diningTables = posSchema.table(
  "dining_table",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    seats: integer("seats"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "core_dining_table_name_check",
      sql`char_length(${table.name}) between 1 and 60`,
    ),
    check(
      "core_dining_table_seats_check",
      sql`${table.seats} is null or ${table.seats} between 1 and 99`,
    ),
    check(
      "core_dining_table_status_check",
      sql`${table.status} in ('active', 'archived')`,
    ),
    uniqueIndex("core_dining_table_active_name_unique")
      .on(table.locationId, sql`lower(${table.name})`)
      .where(sql`${table.status} = 'active'`),
    index("core_dining_table_location_idx").on(
      table.locationId,
      table.status,
      table.sortOrder,
    ),
  ],
);

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
 * El reader legacy calcula el total linea por linea (`modules/pos/server/lines.ts`).
 * `total_snapshot` es una captura privada nullable para el futuro writer/listado V2;
 * null indica ausencia de captura, no importe cero.
 */
export const posOrders = posSchema.table(
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
    /** Spec 0242: nullable durante expand; el fallback legacy usa solo dining_table_id. */
    saleType: text("sale_type"),
    createRequestId: uuid("create_request_id"),
    createRequestFingerprint: text("create_request_fingerprint"),
    /** Proyeccion V2 futura, sin backfill monetario ni semantica de settlement. */
    totalSnapshot: numeric("total_snapshot", { precision: 30, scale: 2 }),
    status: text("status").notNull().default("open"),
    /** Nota libre de la orden (p. ej. los datos para facturar; owner 2026-10-12). Editable solo
     * con la orden abierta, como el resto; null = sin nota. */
    note: text("note"),
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
    settlement: jsonb("settlement").$type<FinancialSettlement>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pos_order_business_id_unique").on(table.businessId, table.id),
    uniqueIndex("pos_order_create_request_unique").on(
      table.businessId,
      table.createRequestId,
    ),
    check(
      "pos_order_sale_type_check",
      sql`${table.saleType} in ('table', 'pickup', 'delivery', 'counter', 'legacy')`,
    ),
    check(
      "pos_order_sale_type_table_check",
      sql`${table.saleType} not in ('pickup', 'delivery', 'counter') or ${table.diningTableId} is null`,
    ),
    check(
      "pos_order_create_request_check",
      sql`(${table.createRequestId} is null and ${table.createRequestFingerprint} is null) or (${table.createRequestId} is not null and ${table.createRequestFingerprint} is not null and ${table.createRequestFingerprint} ~ '^[0-9a-f]{64}$')`,
    ),
    foreignKey({
      name: "pos_order_business_location_fk",
      columns: [table.businessId, table.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
    check(
      "core_pos_order_status_check",
      sql`${table.status} in ('open', 'closed', 'voided')`,
    ),
    check("core_pos_order_version_check", sql`${table.version} >= 1`),
    check(
      "core_pos_order_note_check",
      sql`char_length(${table.note}) between 1 and 1000`,
    ),
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
export const posOrderItems = posSchema.table(
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
      precision: 24,
      scale: 9,
    }).notNull(),
    quantity: numeric("quantity", { precision: 24, scale: 9 }).notNull(),
    measureKind: text("measure_kind").notNull().default("unit"),
    quantityUnit: text("quantity_unit").notNull().default("unit"),
    priceUnit: text("price_unit").notNull().default("unit"),
    conversionVersion: text("conversion_version")
      .notNull()
      .default("mass-si-1"),
    /** Orden de carga de la linea. */
    position: integer("position").notNull(),
    financialSnapshot: jsonb("financial_snapshot").$type<FinancialLine>(),
  },
  (table) => [
    check(
      "core_pos_order_item_price_check",
      sql`${table.unitPriceSnapshot} >= 0`,
    ),
    check("core_pos_order_item_quantity_check", sql`${table.quantity} > 0`),
    // Temporary expand barriers: retain every historical unit row until CP2c.
    check(
      "pos_order_item_quantity_legacy_check",
      sql`${table.quantity} <= 2147483647 and ${table.quantity} = trunc(${table.quantity})`,
    ),
    check(
      "pos_order_item_price_legacy_check",
      sql`${table.unitPriceSnapshot} between -9999999999.99 and 9999999999.99 and ${table.unitPriceSnapshot} = trunc(${table.unitPriceSnapshot}, 2)`,
    ),
    check(
      "pos_order_item_measure_legacy_check",
      sql`${table.measureKind} = 'unit' and ${table.quantityUnit} = 'unit' and ${table.priceUnit} = 'unit' and ${table.conversionVersion} = 'mass-si-1'`,
    ),
    index("core_pos_order_item_order_idx").on(table.posOrderId),
  ],
);

/**
 * Spec 0184 / ADR 0133 — QUE LLEVA EL TICKET IMPRESO DEL POS, por comercio. Solo los bloques
 * OPCIONALES: la base (items, total, fecha, hora, QR) no se configura.
 *
 * - Sin fila = los defaults de las columnas (no se crea fila al dar de alta un negocio).
 * - Ninguna opcion es obligatoria (owner 2026-10-09): `false`/`false` es valido.
 * - Spec 0206: `printing_enabled` = si el negocio imprime tickets. APAGADO por defecto (owner
 *   2026-10-11, «apagada para todos»): sin `true` el POS no muestra «Imprimir».
 * - Un bloque nuevo (p. ej. logo) = una columna con default + el campo del DTO
 *   (`modules/pos/server/ticket-settings.ts`) + su funcion en `modules/pos/ui/printing/ticket/build.ts`.
 */
export const ticketSettings = posSchema.table("ticket_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  printingEnabled: boolean("printing_enabled").notNull().default(false),
  showBusinessName: boolean("show_business_name").notNull().default(true),
  showTable: boolean("show_table").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
const paymentTables = createPosPaymentTables(
  posSchema,
  posOrders,
  paymentMethods,
);
export const posOrderPayments = paymentTables.payments;
