import {
  check,
  foreignKey,
  integer,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { memberships } from "./business";

/**
 * Spec 0067 §4 / ADR 0070 §13 — el bloqueo escalado del PIN del staff, PERSISTIDO.
 *
 * Keyeado por `(business_id, user_id)` y **no por IP**: el rate limit de better-auth esta
 * keyeado por `(IP, path)` y guardado en memoria, asi que todo el staff de un local
 * comparte bucket, un atacante que rota IPs no tiene limite por cuenta, y en lambda no hay
 * donde persistir 15 min / 1 h / 24 h.
 *
 * La FK es **COMPUESTA** porque `core.business_membership` tiene PK compuesta
 * `(business_id, user_id)` y no existe ninguna columna `membership_id` (medido en el arbol
 * el 2026-09-16).
 *
 * Vive en su propio archivo y no en `schema/business.ts` porque ese archivo **ya quedo en
 * 299 lineas** con el `slug` y las columnas del PIN (medido: `wc -l`), contra el limite de
 * 300 del hook `file-size` — que en esta sesion contesto `EXIT=2` a 301, 302 y 306 lineas.
 * Meter esta tabla adentro lo dejaba arriba de 330: **dividir, no extender**. Es el mismo
 * criterio con el que ya esta partido el barrel `server/schema.ts`.
 *
 * La maquina de estados que decide que escribir aca es `server/staff-pin.ts`
 * (`nextLockout`), pura y testeada sin base.
 */
export const staffPinLockouts = core.table(
  "staff_pin_lockout",
  {
    businessId: uuid("business_id").notNull(),
    userId: text("user_id").notNull(),
    failedCount: integer("failed_count").notNull().default(0),
    /** 0, 1, 2, 3: define el umbral del proximo bloqueo y cuanto dura. */
    stage: integer("stage").notNull().default(0),
    /** NULL = sin bloqueo vivo. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.userId] }),
    foreignKey({
      columns: [table.businessId, table.userId],
      foreignColumns: [memberships.businessId, memberships.userId],
      name: "staff_pin_lockout_membership_fk",
    }).onDelete("cascade"),
    check("staff_pin_lockout_stage_check", sql`${table.stage} between 0 and 3`),
    check(
      "staff_pin_lockout_failed_count_check",
      sql`${table.failedCount} >= 0`,
    ),
  ],
);
