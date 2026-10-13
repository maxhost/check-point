import {
  boolean,
  check,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses } from "./business";

/**
 * Spec 0210 / ADR 0138 §4 — LA ACTIVACION GENERICA de un modulo por negocio. Sin fila = apagado.
 *
 * `module_id` es texto validado contra el registro en codigo (`apps/merchant/src/modules/registry.ts`):
 * la base solo acota el largo, asi que agregar un modulo no migra el core. Apagar no borra nada de
 * los datos del modulo (ADR 0138 §6). Este archivo del core NO importa de `schema/modules/`.
 */
export const businessModules = core.table(
  "business_module",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.moduleId] }),
    check(
      "core_business_module_module_id_check",
      sql`char_length(${table.moduleId}) between 1 and 40`,
    ),
  ],
);
