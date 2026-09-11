import { describe, expect, it } from "vitest";
import { assessEventApplicability } from "./billing";
import { subscriptionRow } from "./billing-derive-support";

/**
 * Spec 0063, D5.h — guard de PERTENENCIA y de ORDEN. Archivo nuevo, y la razón de que
 * exista va escrita porque es un HALLAZGO, no una decisión: al ejecutar la mutación M15
 * («invertir el guard de pertenencia») la suite entera quedó VERDE — 591 passed / 0
 * failed —, o sea que `assessEventApplicability` no tenía NINGÚN oráculo en el árbol. El
 * §Plan de pruebas de la spec pide estos casos dentro de `billing-derive.test.ts`, pero
 * ese archivo ya está en 260 líneas y el límite del repo son 300: dividir, no extender.
 * El nombre no es inventado — `billing-derive-support.ts` ya lo referencia en su cabecera.
 *
 * Con el guard invertido, un `deleted` tardío de `sub_1` escribe `free` sobre una `sub_2`
 * VIVA Y FACTURANDO ([R1-I8]). Eso es lo que estas filas ponen en rojo.
 */

const EVENT_AT = Math.floor(Date.UTC(2026, 8, 10) / 1000);

const assess = (args: {
  created?: number;
  subscriptionId?: string;
  row?: ReturnType<typeof subscriptionRow>;
}) =>
  assessEventApplicability({
    event: { created: args.created ?? EVENT_AT },
    subscription: { id: args.subscriptionId ?? "sub_1" },
    row: args.row ?? subscriptionRow(),
  });

describe("assessEventApplicability — pertenencia (spec 0063, D5.h regla 1)", () => {
  it("un evento de `sub_1` sobre una fila con `sub_2` VIVA se ignora", () => {
    // El caso que mató a la v1 de la regla: sin esto, un `deleted` tardío de una
    // suscripción vieja pone `free` sobre una suscripción viva y facturando.
    expect(
      assess({
        subscriptionId: "sub_1",
        row: subscriptionRow({
          stripeSubscriptionId: "sub_2",
          status: "active",
        }),
      }),
    ).toEqual({ apply: false, ignoredReason: "foreign_subscription" });
  });

  it.each([["canceled"], ["incomplete_expired"]])(
    "con la `sub_2` de la fila MUERTA (%s), la suscripción nueva adopta la fila",
    (status) => {
      expect(
        assess({
          subscriptionId: "sub_1",
          row: subscriptionRow({ stripeSubscriptionId: "sub_2", status }),
        }),
      ).toEqual({ apply: true });
    },
  );

  it("una fila SIN suscripción también es adoptable (el alta por Checkout)", () => {
    expect(
      assess({
        subscriptionId: "sub_1",
        row: subscriptionRow({ stripeSubscriptionId: null, status: "active" }),
      }),
    ).toEqual({ apply: true });
  });

  it("el evento de la PROPIA suscripción de la fila se aplica", () => {
    // La otra mitad de la inversión: si el guard se escribe al revés, este caso —el
    // normal, el de todos los días— se ignora y el webhook deja de hacer nada.
    expect(
      assess({
        subscriptionId: "sub_1",
        row: subscriptionRow({
          stripeSubscriptionId: "sub_1",
          status: "active",
        }),
      }),
    ).toEqual({ apply: true });
  });

  it("un status DESCONOCIDO no vuelve adoptable a la fila", () => {
    // `DEAD_STRIPE_STATUS` es una allow-list de MUERTOS: lo desconocido cuenta como vivo,
    // así que una suscripción ajena no puede adoptar la fila por un status que no
    // conocemos.
    expect(
      assess({
        subscriptionId: "sub_1",
        row: subscriptionRow({
          stripeSubscriptionId: "sub_2",
          status: "future_status",
        }),
      }),
    ).toEqual({ apply: false, ignoredReason: "foreign_subscription" });
  });
});

describe("assessEventApplicability — orden (spec 0063, D5.h regla 2)", () => {
  it("un evento ANTERIOR al último aplicado se ignora", () => {
    expect(
      assess({
        created: Math.floor(Date.UTC(2026, 8, 9) / 1000),
        row: subscriptionRow({ lastEventAt: new Date(Date.UTC(2026, 8, 10)) }),
      }),
    ).toEqual({ apply: false, ignoredReason: "stale_event" });
  });

  it("un evento POSTERIOR se aplica — y ahí se ve que `created` son SEGUNDOS", () => {
    // Esta fila es la que caza el bug de unidades: sin el `* 1000`, un `created` de 2026
    // (~1.78e9) queda por debajo de cualquier `lastEventAt` en milisegundos (~1.78e12) y
    // TODO evento legítimo se clasificaría `stale_event`. El webhook dejaría de aplicar
    // nada, en silencio.
    expect(
      assess({
        created: Math.floor(Date.UTC(2026, 8, 11) / 1000),
        row: subscriptionRow({ lastEventAt: new Date(Date.UTC(2026, 8, 10)) }),
      }),
    ).toEqual({ apply: true });
  });

  it("un evento con el MISMO `created` que el último aplicado se aplica", () => {
    // Borde declarado: la regla es «menor que», no «menor o igual». Dos eventos de Stripe
    // pueden compartir `created` (segundos), y descartar el segundo perdería estado.
    const created = Math.floor(Date.UTC(2026, 8, 10) / 1000);
    expect(
      assess({
        created,
        row: subscriptionRow({ lastEventAt: new Date(created * 1000) }),
      }),
    ).toEqual({ apply: true });
  });

  it("sin `last_event_at` no hay nada contra qué comparar: se aplica", () => {
    expect(
      assess({
        created: Math.floor(Date.UTC(2020, 0, 1) / 1000),
        row: subscriptionRow({ lastEventAt: null }),
      }),
    ).toEqual({ apply: true });
  });

  it("PRECEDENCIA declarada: pertenencia ANTES que orden", () => {
    // Con las dos condiciones rotas a la vez gana `foreign_subscription`. Se asevera el
    // orden declarado, no el intuitivo: el motivo que queda escrito en
    // `ignored_reason` es el que se va a leer cuando alguien diagnostique.
    expect(
      assess({
        created: Math.floor(Date.UTC(2026, 8, 9) / 1000),
        subscriptionId: "sub_1",
        row: subscriptionRow({
          stripeSubscriptionId: "sub_2",
          status: "active",
          lastEventAt: new Date(Date.UTC(2026, 8, 10)),
        }),
      }),
    ).toEqual({ apply: false, ignoredReason: "foreign_subscription" });
  });
});

/**
 * LO QUE ESTE ARCHIVO NO PINNEA, declarado: que el WEBHOOK llame a esta función antes de
 * escribir, y que un evento ignorado NO mueva `last_event_at` ([R2-M3]). Las dos son
 * propiedades del cableado, viven en `billing/webhook.ts` —que es fase B y todavía no
 * existe— y su oráculo es la integración Neon del plan de pruebas. Acá está la decisión,
 * no el cableado.
 */
