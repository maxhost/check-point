import type Stripe from "stripe";

import {
  GRANTING_STATUS,
  KNOWN_STRIPE_STATUS,
  PAID_PLANS,
  TERMINAL_STATUS,
  pendingPlanFor,
} from "./derive-rules";
import { matchPrice, type PriceIds } from "./prices";

/**
 * Spec 0063, D5 — CONTRATO. Lo dejó el orquestador antes de despachar; el implementador
 * añade los cuerpos en este mismo archivo.
 *
 * El principio del que cuelga todo el archivo: EL PAYLOAD ES UN DISPARADOR, NO UNA FUENTE
 * DE DATOS. La forma del JSON entrante la fija la `api_version` del ENDPOINT (en prod,
 * `2020-08-27`), no el SDK — así que `subscription.current_period_end` EXISTE en lo que
 * llega y `items.data[0].current_period_end` es `undefined`, con typecheck en verde. Por
 * eso `subscription` acá es SIEMPRE la respuesta de `subscriptions.retrieve(...)`, que
 * viene en la versión del SDK (`2026-07-29.dahlia`) y está correctamente tipada. Del
 * payload se leen `type`, `id` y `created`, y nada más.
 */

/** La fila de `core.subscription` tal como la lee el dominio de billing. */
export type SubscriptionRow = {
  businessId: string;
  plan: string;
  interval: string | null;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** «El tope tiene que caer» — lo dice Stripe. NULL = sin baja programada. */
  pendingPlan: string | null;
  pendingPlanAt: Date | null;
  /** «Esta baja la pedimos NOSOTROS». Desde la spec 0189 es AUDITORÍA: `derive` no lo lee. */
  downgradeRequestedAt: Date | null;
  /** Spec 0189 / ADR 0134 §3: fin de la prueba de 90 días. NULL = sin prueba. */
  trialEndsAt: Date | null;
  /** `created` del último evento APLICADO (guard de orden, D5.h). */
  lastEventAt: Date | null;
};

/**
 * `downgradeRequestedAt` (spec 0063 [R2-1]) discriminaba si un `deleted` aterrizaba en `free`
 * (la baja la pedimos nosotros) o en `none`. Desde la spec 0189 no hay plan gratis: un evento
 * terminal sobre un plan pago aterriza SIEMPRE en `none`, así que la columna queda como
 * auditoría (`cancel` la pone, `resume` la limpia) y esta derivación no la lee.
 */

/**
 * Lo que el webhook debe escribir sobre la fila.
 *
 * `plan` AUSENTE significa «no tocar el plan» — es el caso más frecuente (`past_due`,
 * `incomplete`, `unpaid`, `paused`, price desconocido, status desconocido) y necesita
 * representación explícita, no un `null` ambiguo que se confunda con «plan vacío».
 * `status` es obligatorio: el status crudo de Stripe siempre se registra (D5.e).
 */
export type SubscriptionWrite = {
  plan?: string;
  interval?: string | null;
  status: string;
  pendingPlan: string | null;
  pendingPlanAt: Date | null;
  clearDowngradeRequest: boolean;
  ignoredReason?: IgnoredReason;
};

/**
 * Vocabulario cerrado de `core.stripe_webhook_event.ignored_reason`. Hoy un `invoice.paid`
 * ignorado y un evento aplicado quedan indistinguibles en la base, y en prod ya llegaron de
 * los dos tipos.
 *
 * La spec fija por escrito `event_type_not_handled` (D5.a) y `unknown_business` (D5.c). Los
 * otros cuatro los nombró el ORQUESTADOR al escribir este contrato, para que la columna
 * tenga un vocabulario en vez de prosa libre: no son decisiones del owner. Si el
 * implementador necesita uno más, lo agrega acá y lo dice en su handoff.
 */
export type IgnoredReason =
  | "event_type_not_handled"
  | "unknown_business"
  | "unknown_price"
  | "unknown_status"
  | "foreign_subscription"
  /** [m1, fase B] La fila era adoptable, pero la suscripción recuperada no es nuestra o ya
   * está muerta: un evento puede CREAR o CONFIRMAR una adopción, nunca terminarla. El
   * vocabulario y el guard viven en `applicability.ts`. */
  | "not_adoptable"
  /** [fase B] Un `checkout.session.completed` que no creó ninguna suscripción (no era
   * `mode: "subscription"`): no hay nada que bindear. Lo nombró el IMPLEMENTADOR de la fase
   * B y está declarado en su handoff — sin él, ese caso quedaba marcado procesado con un
   * motivo prestado («unknown_business») que habría mandado a diagnosticar otra cosa. */
  | "session_without_subscription"
  | "stale_event";

export type PlanFromSubscriptionArgs = {
  /** Los ÚNICOS campos del payload que se leen. */
  event: { type: string; created: number };
  /** La respuesta de `subscriptions.retrieve(...)`, no `event.data.object`. */
  subscription: Stripe.Subscription;
  row: SubscriptionRow;
  priceIds: PriceIds;
};

/**
 * DERIVACIÓN DEL PLAN — allow-list POSITIVA, condicionada al plan vigente (spec 0189 §D5).
 * Es normativo; el unit recorre los 4 precios y los 8 status conocidos + uno inventado.
 *
 *   plan = base|plus  según el price que MATCHEÓ (uno de los 4 nuestros)
 *                     Y   status ∈ {active, trialing}
 *                     Y   pause_collection === null
 *                     (el `interval` sale del MISMO price)
 *
 *   evento terminal (status ∈ {canceled, incomplete_expired} o type === '…deleted'):
 *     plan vigente PAGO (`base`/`plus`) → plan = 'none'
 *     si no (p. ej. `trial`)             → `plan` AUSENTE ([R2-7]: una tarjeta rechazada
 *                                          durante la prueba no quita la prueba)
 *     en los dos: pendingPlan = null, pendingPlanAt = null, clearDowngradeRequest = true
 *
 *   status 'past_due' | 'incomplete' | 'unpaid' | 'paused'  →  `plan` AUSENTE
 *   price desconocido / status desconocido                  →  `plan` AUSENTE + ignoredReason
 *
 * `unpaid` y `paused` no bajan el plan (ADR 0059; el bloqueo por impago es PARQUEADO #54).
 * `pause_collection !== null` igual impide SUBIR a un plan pago, porque no cambia el `status`
 * («the subscription status will be unchanged», `Subscriptions.d.ts:220-223`).
 *
 * JERARQUÍA DE `pendingPlan`, EN ESTE ORDEN (D5.f):
 *
 *   si el evento es terminal           → pendingPlan = null, pendingPlanAt = null,
 *                                        clearDowngradeRequest = true   (INCONDICIONAL)
 *   si no, si cancel_at !== null o cancel_at_period_end === true
 *                                      → pendingPlan = 'none'
 *                                        pendingPlanAt = cancel_at
 *                                                     ?? items?.data?.[0]?.current_period_end
 *                                                     ?? null
 *   si no                              → pendingPlan = null, pendingPlanAt = null
 *
 * La primera rama es incondicional PORQUE EN UN `deleted` `cancel_at_period_end` SIGUE EN
 * `true`: «Whether this subscription will (if `status=active`) or DID (if `status=canceled`)
 * cancel at the end of the current billing period» (`Subscriptions.d.ts:132`).
 *
 * El acceso al periodo es DEFENSIVO: `items` es un `ApiList` con `has_more`, truncado a 10
 * y sin orden contractual; `items.data[0]` pelado con la lista vacía tira `TypeError`
 * DENTRO de la transacción → rollback → reintento → mismo `TypeError`.
 *
 * LAS DOS FECHAS SON UNIX SECONDS → `new Date(x * 1000)`; el unit asevera el AÑO.
 */
export type PlanFromSubscription = (
  args: PlanFromSubscriptionArgs,
) => SubscriptionWrite;

/**
 * EL GUARD DE PERTENENCIA, ADOPCIÓN Y ORDEN (D5.h) YA NO VIVE ACÁ: se mudó a
 * `applicability.ts` en la fase B, con su contrato normativo completo. El motivo es de
 * tamaño, no de diseño — este archivo llegó a 281 líneas y el guard de adopción (m1) suma
 * ~35, contra el límite de 300 del hook `file-size`. El barrel reexporta
 * `assessEventApplicability`, así que ningún consumidor cambió de import.
 *
 * La razón por la que es una función APARTE de `planFromSubscription` sigue siendo la
 * misma, y está escrita allá: `SubscriptionWrite` tiene `status` obligatorio, así que no
 * puede expresar «no escribas nada».
 */

export const planFromSubscription: PlanFromSubscription = ({
  event,
  subscription,
  row,
  priceIds,
}) => {
  const status = subscription.status as string;
  const terminal =
    TERMINAL_STATUS.has(status) ||
    event.type === "customer.subscription.deleted";
  // PRECEDENCIA, declarada acá porque D5.d enumera «price desconocido → el plan NO se toca
  // + `ignored_reason`» pero NO fija qué gana si el evento además es terminal: LO TERMINAL
  // GANA. Un evento terminal dice que la suscripción se TERMINÓ, un hecho que no depende de
  // qué price tenía — así que el plan se escribe igual aunque ningún `item.price.id` sea
  // nuestro, y por eso esta rama va ANTES del matcheo de price. Pinneado en
  // `billing-derive.test.ts` («un evento TERMINAL con un price ajeno…»). La otra
  // precedencia del archivo, `unknown_price` > `unknown_status`, está comentada abajo.
  if (terminal) {
    // Un plan PAGO cae a `none`; cualquier otro (la prueba) NO se toca ([R2-7]). Y la rama 1
    // de la jerarquía de `pendingPlan`, INCONDICIONAL: en un `deleted`
    // `cancel_at_period_end` sigue en `true` («will … or DID cancel»).
    return {
      ...(PAID_PLANS.has(row.plan) ? { plan: "none" } : {}),
      status,
      pendingPlan: null,
      pendingPlanAt: null,
      clearDowngradeRequest: true,
    };
  }

  const write: SubscriptionWrite = { status, ...pendingPlanFor(subscription) };
  // El primer item con un price NUESTRO, y su plan+intervalo salen de ESE price.
  const matched = subscription.items?.data
    ?.map((item) => matchPrice(priceIds, item.price?.id))
    .find((match) => match !== null);
  // El price se mira ANTES que el status: describe la suscripción, no su momento. Con los
  // dos desconocidos gana `unknown_price`.
  if (!matched) return { ...write, ignoredReason: "unknown_price" };
  if (!KNOWN_STRIPE_STATUS.has(status)) {
    return { ...write, ignoredReason: "unknown_status" };
  }
  if (GRANTING_STATUS.has(status) && subscription.pause_collection === null) {
    // Plan e intervalo salen del price que MATCHEÓ, nunca de `data[0]`.
    return { ...write, plan: matched.plan, interval: matched.interval };
  }
  // `past_due` | `incomplete` | `unpaid` | `paused`, y `active`/`trialing` con el cobro
  // pausado: el plan NO se toca (ADR 0059 — el impago bloquea el acceso, no degrada).
  return write;
};
