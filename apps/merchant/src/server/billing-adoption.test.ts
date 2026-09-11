import { describe, expect, it } from "vitest";
import { assessEventApplicability, canBindSubscriptionId } from "./billing";
import {
  MONTHLY_PRICE,
  PRICE_IDS,
  YEARLY_PRICE,
  subscriptionFake,
  subscriptionRow,
} from "./billing-derive-support";

/**
 * Spec 0063, D5.h [m1 / m1-b] — EL GUARD DE ADOPCIÓN, en un archivo propio.
 *
 * Sibling de `billing-applicability.test.ts` (que pinnea pertenencia y orden) por el límite
 * de 300 líneas del repo: los dos bloques juntos daban 349. Mismo dominio, misma función.
 *
 * Estos casos son el cierre del hallazgo m1 de la fase A: una DECISIÓN DEL ORQUESTADOR
 * (n.º 7 de la spec), no del owner.
 */

const EVENT_AT = Math.floor(Date.UTC(2026, 8, 10) / 1000);

/**
 * `subscription` es la suscripción RECUPERADA por `subscriptions.retrieve`, no el payload.
 * Desde m1 el guard mira además su `status` y sus `items`: el discriminante de adopción es
 * el estado de la suscripción recuperada, no el tipo de evento (que es un disparador, no un
 * hecho — un `updated` legítimo puede ser el primero que vemos si el `created` se perdió).
 * Por eso este helper NO tiene parámetro de tipo de evento: el guard es ciego a él a
 * propósito.
 */
const assess = (args: {
  created?: number;
  subscriptionId?: string;
  status?: string;
  items?: { priceId: string }[];
  row?: ReturnType<typeof subscriptionRow>;
}) =>
  assessEventApplicability({
    event: { created: args.created ?? EVENT_AT },
    subscription: subscriptionFake({
      id: args.subscriptionId ?? "sub_1",
      status: args.status,
      items: args.items,
    }),
    row: args.row ?? subscriptionRow(),
    priceIds: PRICE_IDS,
  });

/**
 * m1 — EL GUARD DE ADOPCIÓN. Decisión del orquestador n.º 7, no del owner.
 *
 * El agujero que cierra: sobre una fila ADOPTABLE el guard de pertenencia no frena nada
 * (sólo dispara si NO es adoptable), y compuesto con la precedencia «lo terminal gana sobre
 * el price desconocido» de `planFromSubscription`, un `customer.subscription.deleted` de una
 * suscripción AJENA con un price AJENO escribía A1 → `plan='none'`: un negocio VIVO apagado
 * por un evento que nunca fue suyo. El test de la fase A pinneaba sólo la mitad benigna.
 *
 * LA ASIMETRÍA ES LA REGLA: un evento puede CREAR o CONFIRMAR una adopción, NUNCA TERMINARLA.
 */
describe("assessEventApplicability — adopción (spec 0063, D5.h m1)", () => {
  it("A1: fila adoptable (`plus` SIN suscripción) + suscripción ajena con price ajeno → `not_adoptable`", () => {
    // El caso literal del DoD, y el estado real de A1 en prod: `plan='plus'`,
    // `stripe_subscription_id IS NULL`, 1 local activo. Sin este guard, un `deleted` ajeno
    // lo dejaba en `plan='none'`.
    expect(
      assess({
        subscriptionId: "sub_ajena",
        status: "canceled",
        items: [{ priceId: "price_de_otra_cuenta" }],
        row: subscriptionRow({
          plan: "plus",
          stripeSubscriptionId: null,
          status: "active",
        }),
      }),
    ).toEqual({ apply: false, ignoredReason: "not_adoptable" });
  });

  it("fila adoptable + price AJENO pero status VIVO → `not_adoptable`", () => {
    // Las dos mitades del discriminante se aseveran por separado: price nuestro Y status no
    // muerto. Sin esta fila, un guard que sólo mirara el status pasaría igual.
    expect(
      assess({
        subscriptionId: "sub_ajena",
        status: "active",
        items: [{ priceId: "price_de_otra_cuenta" }],
        row: subscriptionRow({ stripeSubscriptionId: null }),
      }),
    ).toEqual({ apply: false, ignoredReason: "not_adoptable" });
  });

  it.each([["canceled"], ["incomplete_expired"]])(
    "fila adoptable + price NUESTRO pero status muerto (%s) → `not_adoptable`",
    (status) => {
      // La otra mitad: ni siquiera una suscripción NUESTRA puede adoptar una fila si llega
      // ya muerta. Un evento no puede TERMINAR una adopción que nunca existió.
      expect(
        assess({
          subscriptionId: "sub_nueva",
          status,
          items: [{ priceId: MONTHLY_PRICE }],
          row: subscriptionRow({ stripeSubscriptionId: null }),
        }),
      ).toEqual({ apply: false, ignoredReason: "not_adoptable" });
    },
  );

  it.each([[MONTHLY_PRICE], [YEARLY_PRICE]])(
    "fila adoptable + price nuestro (%s) y status vivo → ADOPTA",
    (priceId) => {
      expect(
        assess({
          subscriptionId: "sub_nueva",
          status: "active",
          items: [{ priceId }],
          row: subscriptionRow({ stripeSubscriptionId: null }),
        }),
      ).toEqual({ apply: true });
    },
  );

  it("ANTI-DEGENERACIÓN: el `deleted` de la PROPIA suscripción de la fila se aplica aunque llegue muerta", () => {
    // La fila más importante del bloque: sin ella, «no adoptar NUNCA» pasaría todo el resto
    // y el fin de periodo normal —la cancelación que el owner sí pidió— dejaría de
    // aplicarse para siempre. Acá no hay adopción ninguna: el id COINCIDE.
    expect(
      assess({
        subscriptionId: "sub_1",
        status: "canceled",
        items: [{ priceId: MONTHLY_PRICE }],
        row: subscriptionRow({
          stripeSubscriptionId: "sub_1",
          status: "canceled",
        }),
      }),
    ).toEqual({ apply: true });
  });

  it("ANTI-DEGENERACIÓN: el `deleted` de la propia suscripción se aplica con un price AJENO", () => {
    // El price desconocido tampoco puede frenar el evento de la propia suscripción: si
    // alguien cambió el price en el dashboard, la terminación sigue siendo un hecho nuestro.
    expect(
      assess({
        subscriptionId: "sub_1",
        status: "canceled",
        items: [{ priceId: "price_de_otra_cuenta" }],
        row: subscriptionRow({ stripeSubscriptionId: "sub_1" }),
      }),
    ).toEqual({ apply: true });
  });

  it("PRECEDENCIA declarada: adopción ANTES que orden", () => {
    expect(
      assess({
        created: Math.floor(Date.UTC(2026, 8, 9) / 1000),
        subscriptionId: "sub_ajena",
        items: [{ priceId: "price_de_otra_cuenta" }],
        row: subscriptionRow({
          stripeSubscriptionId: null,
          lastEventAt: new Date(Date.UTC(2026, 8, 10)),
        }),
      }),
    ).toEqual({ apply: false, ignoredReason: "not_adoptable" });
  });
});

/**
 * m1-b — EL BINDING DE `checkout.session.completed`. No pasa por la derivación (sólo bindea
 * ids) pero SÍ escribe `stripe_subscription_id`, así que una sesión vieja que se completa
 * tarde podría repuntar la fila a una suscripción distinta de la que está viva y facturando.
 */
describe("canBindSubscriptionId (spec 0063, D5.h m1-b)", () => {
  it("una fila con una suscripción VIVA no acepta el binding de otra", () => {
    expect(
      canBindSubscriptionId(
        { stripeSubscriptionId: "sub_viva", status: "active" },
        "sub_de_una_sesion_vieja",
      ),
    ).toBe(false);
  });

  it("el MISMO id se puede re-bindear: el reintento de una sesión no es una repunta", () => {
    expect(
      canBindSubscriptionId(
        { stripeSubscriptionId: "sub_viva", status: "active" },
        "sub_viva",
      ),
    ).toBe(true);
  });

  it.each([
    [null, "active"],
    ["sub_muerta", "canceled"],
    ["sub_muerta", "incomplete_expired"],
  ])(
    "una fila adoptable (%s / %s) sí bindea",
    (stripeSubscriptionId, status) => {
      expect(
        canBindSubscriptionId({ stripeSubscriptionId, status }, "sub_nueva"),
      ).toBe(true);
    },
  );

  it("un status DESCONOCIDO no vuelve bindeable la fila", () => {
    // Misma polaridad que el resto: `DEAD_STRIPE_STATUS` es allow-list de MUERTOS, así que
    // lo desconocido cuenta como vivo y no se deja sobreescribir.
    expect(
      canBindSubscriptionId(
        { stripeSubscriptionId: "sub_x", status: "future_status" },
        "sub_nueva",
      ),
    ).toBe(false);
  });
});
