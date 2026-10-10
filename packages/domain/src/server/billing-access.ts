import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import {
  DEAD_STRIPE_STATUS,
  hasLiveSubscription,
} from "./entitlements/live-subscription";

/**
 * Spec 0189 §D2 / ADR 0134 §11 — EL EJE DE ACCESO: «tiene suscripcion viva O la prueba no
 * vencio». Es UN eje, con dos lecturas: `billingAccess` (TS, los guards) y `accessSql` (SQL, las
 * consultas del consumidor y del marketing). Las dos comparten la tabla de casos como oraculo
 * (`billing-access.test.ts` y `billing-access.neon.integration.test.ts`).
 *
 * Los imports son solo hojas: `live-subscription.ts` (no importa nada) y `drizzle-orm` para el
 * fragmento. Nada de dominio: lo leen guards de `apps/merchant` y loaders de `consumer/`.
 *
 * **No mira `core.business.status`** (ADR 0073 §1): los guards evaluan el eje `status` ANTES,
 * asi que un negocio suspendido sigue diciendo `business_suspended`.
 */

export type BillingAccess = "subscribed" | "trial" | "blocked";

/** Lo minimo de `core.subscription` con lo que se decide el acceso. */
export type AccessRow = {
  status: string;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
};

/**
 * ORDEN NORMATIVO, primer match gana:
 *  1. `row === null` → `blocked`. FAIL-CLOSED: todo negocio tiene fila (el alta la crea).
 *  2. suscripcion viva (`hasLiveSubscription`: id puesto y status fuera de los muertos) →
 *     `subscribed`. `past_due`/`unpaid`/`incomplete` con id cuentan como vivas: el impago no
 *     bloquea (PARQUEADO #54).
 *  3. `trialEndsAt` ESTRICTAMENTE posterior a `now` → `trial`. Una prueba que vence
 *     exactamente en `now` ya vencio.
 *  4. si no → `blocked`.
 */
export function billingAccess(row: AccessRow | null, now: Date): BillingAccess {
  if (row === null) return "blocked";
  if (hasLiveSubscription(row)) return "subscribed";
  if (row.trialEndsAt !== null && row.trialEndsAt.getTime() > now.getTime()) {
    return "trial";
  }
  return "blocked";
}

/**
 * EL MISMO PREDICADO EN SQL — «tiene acceso» (`subscribed` o `trial`) — sobre una fila de
 * `core.subscription` con ALIAS EXPLICITO (regla de la skill de gotchas: drizzle no califica
 * columnas en un select de una sola tabla, y una subconsulta correlacionada se ata en silencio
 * a la columna homonima). Un `left join` sin fila deja las tres columnas en NULL → `false`, que
 * es el fail-closed del caso 1 de `billingAccess`.
 *
 * Los status muertos salen de `DEAD_STRIPE_STATUS`, no de una copia: las dos lecturas no
 * pueden divergir en la lista. `alias` es un identificador del codigo, nunca un dato.
 */
export function accessSql(alias: string, now: Date): SQL {
  if (!/^[a-z_][a-z0-9_]*$/.test(alias)) {
    throw new Error(`accessSql: alias invalido «${alias}».`);
  }
  const col = (name: string) => sql.raw(`${alias}.${name}`);
  const dead = sql.join(
    [...DEAD_STRIPE_STATUS].map((status) => sql`${status}`),
    sql`, `,
  );
  return sql`((${col("stripe_subscription_id")} is not null and ${col("status")} not in (${dead})) or (${col("trial_ends_at")} is not null and ${col("trial_ends_at")} > ${now.toISOString()}::timestamptz))`;
}

/**
 * «El negocio de esta fila tiene acceso», para una consulta del query builder que no trae
 * `core.subscription`: subconsulta correlacionada con alias explicito (`s_access`). Sin fila de
 * suscripcion el `exists` es falso (fail-closed). `businessId` es la columna EXTERNA ya
 * calificada (una consulta con `join`, donde drizzle califica — gotchas) o un fragmento crudo.
 */
export function businessHasAccessSql(
  businessId: SQL | AnyColumn,
  now: Date,
): SQL {
  return sql`exists (select 1 from core.subscription s_access where s_access.business_id = ${businessId} and ${accessSql("s_access", now)})`;
}

/** El fallo de un guard: misma forma estructural que `ApiOwnerFailure` (`business-status.ts`). */
export type BillingAccessFailure = {
  status: 402;
  code: "payment_required";
  message: string;
};

export const PAYMENT_REQUIRED = "payment_required";

/**
 * §D4 — `null` si el negocio tiene acceso; si no, el 402 `payment_required`. Se llama DESPUES
 * del eje `status`. El mensaje distingue «se termino la prueba» de «se termino la suscripcion»:
 * lo segundo solo si el plan quedo en `none` (lo escribe el webhook al morir una suscripcion
 * paga) y hubo un customer de Stripe (decision tecnica de la spec).
 */
export function billingAccessFailure(
  access: BillingAccess,
  row: { plan: string; stripeCustomerId: string | null } | null,
): BillingAccessFailure | null {
  if (access !== "blocked") return null;
  const subscriptionEnded =
    row !== null && row.plan === "none" && row.stripeCustomerId !== null;
  return {
    status: 402,
    code: PAYMENT_REQUIRED,
    message: subscriptionEnded
      ? "Tu suscripción terminó. Elige un plan para seguir."
      : "Tu prueba terminó. Elige un plan para seguir.",
  };
}

/**
 * §D10 — dias enteros de prueba que quedan, redondeados hacia ARRIBA, solo si el acceso es
 * `trial`; si no, `null`. Con 1 ms de prueba queda «1 dia», nunca «0».
 */
export function trialDaysLeft(
  access: BillingAccess,
  trialEndsAt: Date | null,
  now: Date,
): number | null {
  if (access !== "trial" || trialEndsAt === null) return null;
  return Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000);
}
