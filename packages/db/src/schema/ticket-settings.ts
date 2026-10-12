import { boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { core } from "./_schemas";
import { businesses } from "./business";

/**
 * Spec 0184 / ADR 0133 — QUE LLEVA EL TICKET IMPRESO DEL POS, por comercio. Solo los bloques
 * OPCIONALES: la base (items, total, fecha, hora, QR) no se configura.
 *
 * - Sin fila = los defaults de las columnas (no se crea fila al dar de alta un negocio).
 * - Ninguna opcion es obligatoria (owner 2026-10-09): `false`/`false` es valido.
 * - Spec 0206: `printing_enabled` = si el negocio imprime tickets. APAGADO por defecto (owner
 *   2026-10-11, «apagada para todos»): sin `true` el POS no muestra «Imprimir».
 * - Un bloque nuevo (p. ej. logo) = una columna con default + el campo del DTO
 *   (`server/ticket-settings/settings.ts`) + su funcion en `printing/ticket/build.ts`.
 */
export const ticketSettings = core.table("ticket_settings", {
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
