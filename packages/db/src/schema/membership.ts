import {
  boolean,
  check,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";
import { businesses } from "./business";
import { PERMISSIONS } from "../permissions-catalog";

/**
 * LA MEMBRESIA — quien opera un negocio, con que rol y con que alcances.
 *
 * Vive en su propio archivo desde la spec 0086 y no en `schema/business.ts`, que con la
 * columna `permissions` y sus tres `CHECK` adentro pasaba de 300 lineas (medido con el hook
 * `file-size`). La regla del repo es **dividir, no extender**, y es el mismo movimiento que
 * ya hicieron `schema/staff-pin.ts` y `schema/billing.ts`. Es un traslado LITERAL de la
 * tabla salvo lo que la 0086 agrega; el barril `server/schema.ts` re-exporta, asi que ningun
 * `from "./schema"` cambia una linea.
 */
export const memberships = core.table(
  "business_membership",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    /** `active` operates; `disabled` keeps identity + audit but has no access (ADR 0044). */
    status: text("status").notNull().default("active"),
    /** Spec 0067 §4: parte local del login del staff (`handle@slug`), unica POR NEGOCIO.
     * `handle` y `pin_hash` (hash, nunca el PIN) son NULLABLE en el tipo y obligatorios
     * por CHECK solo cuando `role='staff'`: el owner entra por email y no tiene ninguno. */
    handle: text("handle"),
    /** Spec 0086 §1 / ADR 0079 §4 — LOS ALCANCES POR OBJETO DEL INTEGRANTE.
     *
     * Vive en la fila de la membresia y no en una tabla aparte porque **el guard ya lee esta
     * fila**: `ownerContext`, `membershipContext` y `operatorBusiness` resuelven la membresia
     * con un `innerJoin(businesses)` que existe desde siempre, asi que esto es una columna
     * mas en una consulta que ya se hace — cero consultas nuevas en el camino caliente. Una
     * tabla `membership_permission` costaria un join por request para ganar un historial que
     * el log de auditoria (spec B) lleva mejor.
     *
     * **El owner la deja SIEMPRE en `'{}'`**: es owner, tiene todo. Lo hace imposible de
     * violar el `owner_no_permissions_check` de abajo, y por eso
     * `GET /api/merchant/session` devuelve los siete para un owner **sin leer esta columna**
     * (la API expone la capacidad, no la fila). */
    permissions: text("permissions")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    pinHash: text("pin_hash"),
    pinMustChange: boolean("pin_must_change").notNull().default(true),
    pinUpdatedAt: timestamp("pin_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.userId] }),
    check(
      "business_membership_role_check",
      sql`${table.role} in ('owner', 'staff')`,
    ),
    check(
      "business_membership_status_check",
      sql`${table.status} in ('active', 'disabled')`,
    ),
    check(
      "business_membership_staff_identity_check",
      sql`${table.role} <> 'staff' or (${table.handle} is not null and ${table.pinHash} is not null)`,
    ),
    /** CHECK 1 — ningun valor fuera del catalogo. `<@` es contencion de conjuntos, y la
     * lista sale de `permissions-catalog.ts` para que el conjunto que la base declara
     * CERRADO y el que valida el writer sean literalmente el mismo. **No impide duplicados**
     * (`{catalog,catalog}` lo satisface): eso lo normaliza el writer. */
    check(
      "business_membership_permissions_check",
      sql`${table.permissions} <@ ${sql.raw(
        `array[${PERMISSIONS.map((permission) => `'${permission}'`).join(", ")}]::text[]`,
      )}`,
    ),
    /** CHECK 2 — el owner NO tiene permisos: los ignora por definicion (ADR 0079 §4). Sin
     * esto existe el estado «owner con permisos» y alguien va a terminar decidiendo por el.
     *
     * **`role <> 'owner'` y no `role = 'staff'`**: si mañana el `CHECK` de `role` gana un
     * tercer valor, esta forma **falla cerrado** sobre el valor nuevo en vez de dejarlo
     * pasar sin invariante. */
    check(
      "business_membership_owner_no_permissions_check",
      sql`${table.role} <> 'owner' or ${table.permissions} = '{}'`,
    ),
    /** CHECK 3 — un staff SIEMPRE tiene al menos uno (decision del owner: dar de alta a
     * alguien que no puede hacer nada no tiene sentido, y para eso existe desactivarlo).
     *
     * **`array_length('{}', 1)` devuelve `NULL`, no `0`**: sin el `coalesce` este CHECK no
     * muerde el unico caso que existe para cazar, porque `NULL >= 1` es `NULL` y un CHECK
     * con resultado `NULL` **pasa**. */
    check(
      "business_membership_staff_has_permission_check",
      sql`${table.role} <> 'staff' or coalesce(array_length(${table.permissions}, 1), 0) >= 1`,
    ),
    uniqueIndex("core_business_membership_handle_unique").on(
      table.businessId,
      table.handle,
    ),
  ],
);
