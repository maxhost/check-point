import { check, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses } from "./business";

/**
 * Spec 0084 / ADR 0078 §2-3 — EL PROGRESO DE LOS TOURS DEL ONBOARDING.
 *
 * La primera tabla de escritura del onboarding. Existe porque «vi un tour» **no es un hecho
 * derivable de ninguna tabla de dominio**: no hay una sola columna de «visto» en el schema, y
 * el candidato mas tentador —`loyalty_program.updated_at`— es `defaultNow()` **sin
 * `$onUpdate`** (`schema/loyalty.ts`), asi que «el merchant reviso su programa y no cambio
 * nada» no deja rastro.
 *
 * **Archivo propio y no dentro de `schema/business.ts`:** ese archivo esta en 281 lineas y el
 * hook `file-size` corta en 300. La regla del repo es dividir, no extender.
 *
 * ### PK compuesta `(business_id, tour_id)`, y NO hay columna de usuario
 *
 * El progreso es **POR NEGOCIO**, decision textual del owner (ADR 0078 §3: *«el tour se guarda
 * por negocio»*), tomada con la alternativa —por usuario— a la vista. Esa ausencia es
 * deliberada: agregar la columna despues seria una migracion. Si mañana un negocio tuviera dos
 * owners, el tour que completa el primero aparece completo para el segundo, y eso es coherente
 * con que el checklist describa el estado **del negocio**.
 *
 * **El nombre de esa columna que no existe NO se escribe en este archivo, ni en prosa:** el
 * criterio del DoD de la spec 0084 es un barrido de `rg` por ese nombre sobre ESTE archivo, y
 * un barrido sintactico no distingue una columna de una mencion. Medido: con el nombre citado
 * en este docblock, el barrido devolvia dos hits sobre una tabla que no tiene la columna.
 * Quien quiera aseverar la ausencia contra la BASE tiene el caso «la tabla NO tiene ninguna
 * columna de usuario» en `onboarding-tours.neon.integration.test.ts`.
 *
 * La PK es ademas lo que hace idempotente a la escritura (el `on conflict` del upsert apunta a
 * ella) y lo que sirve a la unica lectura prevista, la de la spec 0085 —por `business_id`—:
 * **el prefijo de la PK ya cubre las dos**, asi que no hay indice extra.
 *
 * ### `status` como texto con `CHECK`
 *
 * Es la convencion del repo (`business.status`, `business_membership.status`): no hay enums de
 * PG en `core`. Los dos valores se guardan **distintos** aunque los dos proyecten `done: true`
 * por HTTP — con un booleano, «cuantos merchants saltearon todo» seria una pregunta que ya no
 * se puede hacer.
 *
 * ### No hay `created_at`
 *
 * Una fila se crea una vez y se pisa como mucho una vez (`skipped` → `completed`); `updated_at`
 * alcanza. Nada de andamiaje sin su tarea.
 */
export const businessOnboardingTours = core.table(
  "business_onboarding_tour",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    /** La clave ESTABLE del tour (`"staff"`, `"catalog"`, …). Su catalogo cerrado vive en
     * `server/onboarding/tours.ts`, que es lo que la escritura usa para rechazar un id
     * desconocido con 404. */
    tourId: text("tour_id").notNull(),
    status: text("status").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.tourId] }),
    check(
      "business_onboarding_tour_status_check",
      sql`${table.status} in ('completed', 'skipped')`,
    ),
  ],
);
