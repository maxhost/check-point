import type Stripe from "stripe";

import {
  GRANTING_STATUS,
  KNOWN_STRIPE_STATUS,
  PAID_PLANS,
  TERMINAL_STATUS,
  pendingPlanFor,
} from "./derive-rules";
import { DEAD_STRIPE_STATUS } from "./plan-change";

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
  /** «Esta baja la pedimos NOSOTROS» — lo decimos nosotros. Ver el bloque de abajo. */
  downgradeRequestedAt: Date | null;
  /** `created` del último evento APLICADO (guard de orden, D5.h). */
  lastEventAt: Date | null;
};

/**
 * POR QUÉ `downgradeRequestedAt` ES UNA COLUMNA PROPIA Y NO SE DEDUCE DE `pendingPlan`
 * ([R2-1], el bloqueante peor de la segunda ronda).
 *
 * La versión anterior de la spec usaba `pendingPlan` como discriminante y afirmaba «no
 * hace falta ninguna columna nueva». Era falso, y se demostraba leyendo la propia spec dos
 * secciones más abajo: la jerarquía de `pending_plan` (abajo) escribe `'free'` ante
 * CUALQUIER evento con `cancel_at_period_end === true`, sin mirar quién originó la baja — y
 * eso es exactamente lo que setea el botón «Cancel subscription» del dashboard de Stripe.
 * Secuencia que rompía el invariante central, con 3 locales activos: el owner cancela desde
 * el dashboard → `updated` → `pending_plan='free'` → fin de periodo → `deleted` → la regla
 * vieja lo clasificaba «esperado» y escribía `plan='free'` CON 3 LOCALES ACTIVOS, el estado
 * que la spec entera existe para prohibir.
 *
 * El discriminante era falsificable por el actor del que había que defenderse. Regla
 * general, ya en CLAUDE.md: un discriminante de intención no puede leerse de un campo que
 * el otro lado también escribe. `downgradeRequestedAt` lo escriben SOLO nuestras rutas
 * (`cancel` lo pone; `resume` y `settle-free` lo limpian); el webhook NUNCA lo escribe.
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
  | "stale_event";

export type PlanFromSubscriptionArgs = {
  /** Los ÚNICOS campos del payload que se leen. */
  event: { type: string; created: number };
  /** La respuesta de `subscriptions.retrieve(...)`, no `event.data.object`. */
  subscription: Stripe.Subscription;
  row: SubscriptionRow;
  priceIds: { monthly: string; yearly: string };
};

/**
 * DERIVACIÓN DEL PLAN — allow-list POSITIVA, condicionada al plan vigente (D5.d).
 * Es normativo; el unit recorre los 8 status conocidos + uno inventado.
 *
 *   plan = 'plus'  si  algún item.price.id ∈ {monthly, yearly}
 *                  Y   status ∈ {active, trialing}
 *                  Y   pause_collection === null
 *
 *   plan = 'free'  si  (status ∈ {canceled, incomplete_expired} o type === '…deleted')
 *                  Y   (downgradeRequestedAt !== null      // la baja la pedimos NOSOTROS
 *                       o currentPlan NO es un plan pago)   // [R2-7]
 *
 *   plan = 'none'  si  (status ∈ {canceled, incomplete_expired} o type === '…deleted')
 *                  Y   downgradeRequestedAt === null
 *                  Y   currentPlan ES un plan pago
 *
 *   status 'past_due' | 'incomplete' | 'unpaid' | 'paused'  →  `plan` AUSENTE
 *   price desconocido / status desconocido                  →  `plan` AUSENTE + ignoredReason
 *
 * [R2-7] «`currentPlan` NO es un plan pago» evita convertir en `none` a un negocio `free`
 * que nunca tuvo nada: uno de los 9 `free` aprieta «Mejorar a Plus», la tarjeta se rechaza,
 * la suscripción queda `incomplete`, a las 23 h pasa a `incomplete_expired` (terminal,
 * `Subscriptions.d.ts:252`) y el negocio quedaría `plan='none'` POR HABER INTENTADO PAGAR.
 *
 * `unpaid` y `paused` no bajan el plan (ADR 0059: el impago bloquea el acceso, no degrada).
 * `pause_collection !== null` igual impide SUBIR a `plus`, porque no cambia el `status`
 * («the subscription status will be unchanged», `Subscriptions.d.ts:220-223`).
 *
 * El `interval` sale del price que MATCHEÓ — y el `price` de un `SubscriptionItem` es un
 * objeto, no un string (`SubscriptionItems.d.ts:90`): no hace falta ninguna llamada extra.
 *
 * JERARQUÍA DE `pendingPlan`, EN ESTE ORDEN (D5.f):
 *
 *   si plan derivado ∈ {'free','none'} → pendingPlan = null, pendingPlanAt = null,
 *                                        clearDowngradeRequest = true   (INCONDICIONAL)
 *   si no, si cancel_at !== null o cancel_at_period_end === true
 *                                      → pendingPlan = 'free'
 *                                        pendingPlanAt = cancel_at
 *                                                     ?? items?.data?.[0]?.current_period_end
 *                                                     ?? null
 *   si no                              → pendingPlan = null, pendingPlanAt = null
 *
 * La primera rama es incondicional PORQUE EN UN `deleted` `cancel_at_period_end` SIGUE EN
 * `true`: lo dice el propio campo — «Whether this subscription will (if `status=active`) or
 * DID (if `status=canceled`) cancel at the end of the current billing period»
 * (`Subscriptions.d.ts:132`). Sin la jerarquía la fila quedaba `plan='free'` Y
 * `pending_plan='free'`, con la UI diciendo «tu plan baja a Free el …» estando YA en free y
 * un botón *Reanudar* sobre una suscripción muerta.
 *
 * `cancel_at` entra en la condición porque es INDEPENDIENTE de `cancel_at_period_end`
 * (`Subscriptions.d.ts:129`) y se puede setear desde el dashboard. Mutación M8.
 *
 * El acceso al periodo es DEFENSIVO: `items` es un `ApiList` con `has_more`, truncado a 10
 * y sin orden contractual; `items.data[0]` pelado con la lista vacía tira `TypeError`
 * DENTRO de la transacción → rollback → reintento → mismo `TypeError`. «No se pudo
 * determinar la fecha» es un caso VÁLIDO: `pendingPlan` puesto, `pendingPlanAt` en null, y
 * la UI lo dice sin fecha. Mutación M9.
 *
 * LAS DOS FECHAS SON UNIX SECONDS → `new Date(x * 1000)` contra una columna `timestamptz`.
 * Sin el `* 1000` la fecha cae en 1970 y el bug es visual, no de tipos: el unit asevera el
 * AÑO.
 */
export type PlanFromSubscription = (
  args: PlanFromSubscriptionArgs,
) => SubscriptionWrite;

/**
 * GUARD DE PERTENENCIA Y DE ORDEN (D5.h), separado de `planFromSubscription`.
 *
 * Está aparte por una razón que el orquestador anota como HALLAZGO al materializar el
 * contrato, no como algo que la spec ya dijera: `SubscriptionWrite` tiene `status`
 * OBLIGATORIO, así que no puede expresar «no escribas nada». Si el guard de pertenencia
 * viviera dentro de `planFromSubscription`, un evento de `sub_1` llegado sobre una fila que
 * ya está en `sub_2` viva escribiría igual el status de `sub_1` encima — que es justo lo
 * que D5.h prohíbe. Como función propia, además, tiene su propio oráculo, que es lo que la
 * mutación M15 necesita para morder.
 *
 * Reglas, las dos de PERTENENCIA y ORDEN, no de contenido:
 *
 *  1. se ignora todo evento cuyo `subscription.id` ≠ `row.stripeSubscriptionId`, SALVO que
 *     la fila no tenga uno o que su status esté en `DEAD_STRIPE_STATUS` — solo ahí una
 *     suscripción nueva puede adoptar la fila. [R1-I8] La v1 decía lo contrario («solo un
 *     id distinto puede volver a mover el plan»), que leída literal deja que un `deleted`
 *     tardío de `sub_1` ponga `free` sobre `sub_2` VIVA Y FACTURANDO.
 *  2. se ignora todo evento con `event.created` MENOR que `row.lastEventAt`.
 *
 * [R2-M3] UN EVENTO IGNORADO (por tipo, pertenencia u orden) NO MUEVE `last_event_at`: si
 * lo moviera, la regla 2 podría tapar un evento legítimo posterior con `created` menor.
 */
export type EventApplicability =
  | { apply: true }
  | { apply: false; ignoredReason: "foreign_subscription" | "stale_event" };

export type AssessEventApplicability = (args: {
  event: { created: number };
  subscription: Pick<Stripe.Subscription, "id">;
  row: Pick<SubscriptionRow, "stripeSubscriptionId" | "status" | "lastEventAt">;
}) => EventApplicability;

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
    // `free` SÓLO si la baja la pedimos nosotros o el plan vigente no era pago; si no,
    // `none`. Y la rama 1 de la jerarquía de `pendingPlan`, INCONDICIONAL: en un
    // `deleted` `cancel_at_period_end` sigue en `true` («will … or DID cancel»).
    return {
      plan:
        row.downgradeRequestedAt !== null || !PAID_PLANS.has(row.plan)
          ? "free"
          : "none",
      status,
      pendingPlan: null,
      pendingPlanAt: null,
      clearDowngradeRequest: true,
    };
  }

  const write: SubscriptionWrite = { status, ...pendingPlanFor(subscription) };
  const matched = subscription.items?.data?.find(
    (item) =>
      item.price?.id === priceIds.monthly || item.price?.id === priceIds.yearly,
  );
  // El price se mira ANTES que el status: describe la suscripción, no su momento. Con los
  // dos desconocidos gana `unknown_price`.
  if (!matched) return { ...write, ignoredReason: "unknown_price" };
  if (!KNOWN_STRIPE_STATUS.has(status)) {
    return { ...write, ignoredReason: "unknown_status" };
  }
  if (GRANTING_STATUS.has(status) && subscription.pause_collection === null) {
    // El intervalo sale del price que MATCHEÓ, nunca de `data[0]`.
    return {
      ...write,
      plan: "plus",
      interval: matched.price.id === priceIds.yearly ? "year" : "month",
    };
  }
  // `past_due` | `incomplete` | `unpaid` | `paused`, y `active`/`trialing` con el cobro
  // pausado: el plan NO se toca (ADR 0059 — el impago bloquea el acceso, no degrada).
  return write;
};

export const assessEventApplicability: AssessEventApplicability = ({
  event,
  subscription,
  row,
}) => {
  // Sólo una fila SIN suscripción, o con la suya ya muerta, puede ser adoptada por otra.
  const adoptable =
    row.stripeSubscriptionId === null || DEAD_STRIPE_STATUS.has(row.status);
  if (!adoptable && row.stripeSubscriptionId !== subscription.id) {
    return { apply: false, ignoredReason: "foreign_subscription" };
  }
  if (
    row.lastEventAt !== null &&
    event.created * 1000 < row.lastEventAt.getTime()
  ) {
    return { apply: false, ignoredReason: "stale_event" };
  }
  return { apply: true };
};
