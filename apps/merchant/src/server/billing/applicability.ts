import type Stripe from "stripe";

import type { IgnoredReason, SubscriptionRow } from "./derive";
import { DEAD_STRIPE_STATUS } from "./plan-change";

/**
 * Spec 0063, D5.h — GUARD DE PERTENENCIA, DE ADOPCIÓN Y DE ORDEN.
 *
 * Mudado desde `derive.ts` en la fase B, sin cambiar ninguna regla de las que ya estaban:
 * ese archivo llegó a 281 líneas y el guard de adopción (m1) agrega ~35, contra un límite
 * de 300 (hook `file-size`) — dividir, no extender. El barrel reexporta, así que ningún
 * consumidor cambia de import.
 *
 * Está separado de `planFromSubscription` por una razón que no es estética:
 * `SubscriptionWrite` tiene `status` OBLIGATORIO, así que no puede expresar «no escribas
 * nada». Si el guard viviera dentro de la derivación, un evento de `sub_1` llegado sobre
 * una fila que ya está en `sub_2` viva escribiría igual el status de `sub_1` encima — que
 * es justo lo que D5.h prohíbe. Como función propia tiene su propio oráculo, que es lo que
 * la mutación M15 necesitó para morder (cuando se corrió por primera vez en la fase A la
 * suite entera quedó VERDE: el guard no tenía ninguno).
 *
 * LAS TRES REGLAS, EN ORDEN. PRIMER MATCH GANA:
 *
 *  1. PERTENENCIA: se ignora todo evento cuyo `subscription.id` ≠ `row.stripeSubscriptionId`
 *     SALVO que la fila sea ADOPTABLE — que no tenga ninguna suscripción, o que la suya
 *     esté en `DEAD_STRIPE_STATUS`. [R1-I8] La v1 decía lo contrario («solo un id distinto
 *     puede volver a mover el plan»), que leída literal deja que un `deleted` tardío de
 *     `sub_1` ponga `free` sobre `sub_2` VIVA Y FACTURANDO.
 *  2. ADOPCIÓN (m1): sobre una fila adoptable, la suscripción RECUPERADA tiene que ser
 *     NUESTRA y no estar muerta. Ver el bloque de abajo.
 *  3. ORDEN: se ignora todo evento con `event.created` MENOR que `row.lastEventAt`.
 *
 * [R2-M3] UN EVENTO IGNORADO (por tipo, pertenencia, adopción u orden) NO MUEVE
 * `last_event_at`: si lo moviera, la regla 3 podría tapar un evento legítimo posterior con
 * `created` menor.
 */

/**
 * POR QUÉ EXISTE EL GUARD DE ADOPCIÓN (m1 — decisión del orquestador n.º 7 de la spec, NO
 * del owner; el revisor independiente de la fase A coincidió en el diagnóstico y en la
 * ubicación del fix).
 *
 * La regla 1 sola no alcanza: LA ADOPCIÓN ES UNA PUERTA ABIERTA. Sobre una fila adoptable
 * —`stripe_subscription_id IS NULL` o status muerto, que es el caso de A1 en prod: está en
 * `plus` sin suscripción— el guard no frena nada, porque solo dispara si NO es adoptable.
 * Compuesto con la precedencia «lo terminal gana sobre el price desconocido» que pinnea
 * `planFromSubscription`, un `customer.subscription.deleted` de una suscripción AJENA con
 * un price AJENO escribía A1 → `plan='none'`: un negocio vivo apagado por un evento que
 * nunca fue suyo.
 *
 * LA ASIMETRÍA ES LA REGLA, y es el enunciado que hay que conservar: UN EVENTO PUEDE CREAR
 * O CONFIRMAR UNA ADOPCIÓN, NUNCA TERMINARLA. El `deleted` de fin de periodo de la PROPIA
 * suscripción de la fila sigue aplicando, porque ahí `sameSubscription` es verdadero y no
 * hay adopción ninguna.
 *
 * EL ATAJO OBVIO ESTÁ MAL, y queda escrito para que nadie lo «simplifique»: la regla NO
 * puede ser «adoptable solo por `customer.subscription.created`». Un `updated` legítimo
 * puede ser el primer evento que veamos si el `created` se perdió, y el diseño entero de D5
 * dice que EL TIPO DE EVENTO ES UN DISPARADOR, NO UN HECHO. El discriminante sale del
 * ESTADO DE LA SUSCRIPCIÓN RECUPERADA —price nuestro + status no muerto—, que es dato que
 * da Stripe por `retrieve` y que el actor del que hay que defenderse NO controla. Es la
 * regla de `CLAUDE.md` sobre discriminantes («preguntá quién más puede escribir ese
 * campo»), aplicada: `price.id` lo fija nuestra cuenta de Stripe, a diferencia de
 * `cancel_at_period_end`, que lo escribe también el botón del dashboard.
 */
export type EventApplicability =
  | { apply: true }
  | {
      apply: false;
      ignoredReason: Extract<
        IgnoredReason,
        "foreign_subscription" | "not_adoptable" | "stale_event"
      >;
    };

export type AssessEventApplicability = (args: {
  /** El ÚNICO campo del payload que entra acá. */
  event: { created: number };
  /**
   * La respuesta de `subscriptions.retrieve(...)`. Desde m1 no alcanza con el `id`: el
   * discriminante de adopción son el `status` y los `items` de la suscripción recuperada.
   */
  subscription: Pick<Stripe.Subscription, "id" | "status" | "items">;
  row: Pick<SubscriptionRow, "stripeSubscriptionId" | "status" | "lastEventAt">;
  priceIds: { monthly: string; yearly: string };
}) => EventApplicability;

export const assessEventApplicability: AssessEventApplicability = ({
  event,
  subscription,
  row,
  priceIds,
}) => {
  if (row.stripeSubscriptionId !== subscription.id) {
    // Sólo una fila SIN suscripción, o con la suya ya muerta, puede ser adoptada por otra.
    const adoptable =
      row.stripeSubscriptionId === null || DEAD_STRIPE_STATUS.has(row.status);
    if (!adoptable) {
      return { apply: false, ignoredReason: "foreign_subscription" };
    }
    // m1: adoptar exige que la suscripción recuperada sea NUESTRA (un price de nuestra
    // cuenta) y que esté VIVA. Un evento puede crear o confirmar una adopción, nunca
    // terminarla.
    const ours = subscription.items?.data?.some(
      (item) =>
        item.price?.id === priceIds.monthly ||
        item.price?.id === priceIds.yearly,
    );
    if (!ours || DEAD_STRIPE_STATUS.has(subscription.status as string)) {
      return { apply: false, ignoredReason: "not_adoptable" };
    }
  }
  if (
    row.lastEventAt !== null &&
    event.created * 1000 < row.lastEventAt.getTime()
  ) {
    return { apply: false, ignoredReason: "stale_event" };
  }
  return { apply: true };
};

/**
 * EL MISMO RAZONAMIENTO PARA EL BINDING DE `checkout.session.completed` (m1-b, misma
 * decisión del orquestador).
 *
 * Ese camino no pasa por la derivación —sólo bindea ids— pero SÍ escribe
 * `stripe_subscription_id`, así que una sesión vieja que se completa tarde podría repuntar
 * la fila a una suscripción distinta de la que está viva y facturando. No puede reusar
 * `assessEventApplicability` porque ahí no hay una `Subscription` recuperada que mirar: el
 * único dato es el id que trae la sesión.
 *
 * Regla: se bindea sólo si la fila es adoptable (sin suscripción o con la suya muerta) o si
 * el id COINCIDE con el que ya tiene. En otro caso no se escribe nada y queda
 * `ignored_reason='foreign_subscription'`.
 */
export function canBindSubscriptionId(
  row: Pick<SubscriptionRow, "stripeSubscriptionId" | "status">,
  subscriptionId: string,
): boolean {
  return (
    row.stripeSubscriptionId === subscriptionId ||
    row.stripeSubscriptionId === null ||
    DEAD_STRIPE_STATUS.has(row.status)
  );
}
