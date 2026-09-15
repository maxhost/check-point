import { describe, expect, it } from "vitest";
import {
  subscriptionOffers,
  type SubscriptionOffers,
  type SubscriptionView,
} from "./billing";

/**
 * Spec 0063, D7 — LA TABLA DE ESTADOS DE LA UI como función pura. Sin base y sin un solo mock
 * de red.
 *
 * SEGUNDO CORTE (spec 0064, fase B): el modal de la baja se fue entero a
 * `billing-cancel-dialog.test.ts`. Este archivo estaba en 299/300 al hook y la fase le suma al
 * modal dos props y dos casos nuevos (el aviso de «cuándo conviene bajar», con y sin fecha de
 * renovación). Se dividió ANTES de agregar, no después.
 *
 * CORTE QUE EL ENCARGO NO PREVEÍA, RATIFICADO POR EL ORQUESTADOR: la whitelist manda el
 * oráculo del helper nuevo en `billing-view.test.ts` y AHÍ NO ENTRA — medido al hook, con el
 * bloque adentro da **370 líneas** contra el límite de 300 (`EXIT=2`). Sibling, que es el
 * patrón que la spec ya aplicó doce veces; `billing-view.test.ts` queda con el DTO y las dos
 * allow-lists de texto.
 * LO QUE NO PINNEA: el CABLEADO de la PÁGINA. Acá la DECISIÓN dice X, no que el owner VEA X
 * — eso es `billing-pages.neon.integration.test.ts`. Es el hueco de `choosePushPromptView`
 * (tarea 38), donde un revisor reintrodujo el bug en el LLAMADOR con los 5 gates verdes.
 */

/**
 * LA TABLA DE D7, FILA POR FILA. El docblock de `subscriptionOffers` dice «guardas en orden,
 * primer match gana, ES NORMATIVO»: ésta es la única cosa que hace verdadera esa frase.
 *
 * El resumen colapsa LAS SEIS salidas en un string para que cada fila de D7 quepa en una
 * línea Y para que nada quede sin aseverar: si la función empezara a ofrecer algo DE MÁS, el
 * string cambia y la fila se pone roja. Se compara contra un literal escrito a mano — nunca
 * contra otra llamada a la función, que sería el oráculo circular.
 */
function summary(offers: SubscriptionOffers): string {
  return [
    offers.upgrade ?? "-",
    offers.downgrade?.endpoint.replace("/api/billing/", "") ?? "-",
    offers.intervalUpgrade ? "anual" : "-",
    offers.pendingDowngrade ?? "-",
    offers.paymentPending ? "cobro" : "-",
    offers.noPlan ? "sin-plan" : "-",
  ].join(" ");
}

const AT = "2026-12-01T00:00:00.000Z";

const view = (o: Partial<SubscriptionView> = {}): SubscriptionView => ({
  plan: "free",
  status: "active",
  interval: null,
  pendingPlan: null,
  pendingPlanAt: null,
  ...o,
});

describe("subscriptionOffers — la tabla de D7 como función pura (spec 0063)", () => {
  it.each([
    // plan, status, interval, pendingPlan, pendingPlanAt, resumen
    ["free", "active", null, null, null, "Mejorar a Plus - - - - -"],
    ["plus", "active", "month", null, null, "- cancel anual - - -"],
    ["plus", "active", "year", null, null, "- cancel - - - -"],
    ["plus", "active", null, null, null, "- cancel anual - - -"],
    ["plus", "canceled", "month", null, null, "- cancel - - - -"],
    ["plus", "incomplete_expired", "month", null, null, "- cancel - - - -"],
    [
      "none",
      "canceled",
      null,
      null,
      null,
      "Volver a Plus settle-free - - - sin-plan",
    ],
    ["plus", "active", "month", "free", AT, "- - - with_date - -"],
    ["plus", "active", "month", "free", null, "- - - without_date - -"],
    ["plus", "past_due", "month", null, null, "- - - - cobro -"],
    ["plus", "unpaid", "month", null, null, "- - - - cobro -"],
    ["plus", "past_due", "month", "free", AT, "- - - - cobro -"],
    ["plus", "active", "month", "", null, "- cancel anual - - -"],
    ["enterprise", "active", null, null, null, "Mejorar a Plus - - - - -"],
    ["none", "active", null, "free", AT, "- - - with_date - -"],
  ])(
    "plan=%s status=%s interval=%s pending=%s/%s → %s",
    (plan, status, interval, pendingPlan, pendingPlanAt, expected) => {
      expect(
        summary(
          subscriptionOffers(
            view({ plan, status, interval, pendingPlan, pendingPlanAt }),
          ),
        ),
      ).toBe(expected);
    },
  );

  it("`past_due` con baja programada: gana la guarda 1 y no ofrece NADA", () => {
    // PRECEDENCIA DECLARADA, no la intuitiva. Antes de la spec 0064 esta fila conservaba
    // «Reanudar» —para no dejar al owner atrapado—; con la baja inmediata esa ruta no existe
    // y la guarda 1 esconde todo. Lo que queda es el aviso de cobro, que es la única acción
    // real: pagar.
    const offers = subscriptionOffers(
      view({ plan: "plus", status: "unpaid", pendingPlan: "free" }),
    );
    expect(offers.paymentPending).toBe(true);
    expect([offers.upgrade, offers.downgrade, offers.intervalUpgrade]).toEqual([
      null,
      null,
      false,
    ]);
    // La guarda 1 gana: el texto de la baja programada es de la guarda 2 y no aparece.
    expect(offers.pendingDowngrade).toBeNull();
  });

  it("una baja programada sobre `none` gana a la guarda del estado `none`", () => {
    // Fila anti-degeneración del ORDEN: si las guardas 2 y 3 se invirtieran, este caso
    // pasaría a decir «sin plan» y ofrecería las dos salidas de D10 sobre una suscripción que
    // todavía está viva hasta el fin del periodo.
    const offers = subscriptionOffers(
      view({ plan: "none", pendingPlan: "free", pendingPlanAt: AT }),
    );
    expect([offers.noPlan, offers.pendingDowngrade]).toEqual([
      false,
      "with_date",
    ]);
  });

  it("«plus con la suscripción MUERTA» conserva la salida 2 de D10", () => {
    // LAS DOS SALIDAS de ese estado (spec, corrección del orquestador): D8 reconcilia, y el
    // BOTÓN de D10 sigue estando. Si esta fila perdiera el botón, `already_on_plan` sería un
    // callejón sin salida cuando Stripe no tiene nada que contar. El cableado de las dos
    // juntas está en `billing-pages.neon.integration.test.ts`.
    const offers = subscriptionOffers(
      view({ plan: "plus", status: "canceled", interval: "month" }),
    );
    expect(offers.downgrade).toEqual({
      label: "Bajar a Free",
      endpoint: "/api/billing/cancel",
    });
    // Y NO se ofrece cambiar el intervalo de una suscripción que ya no existe.
    expect(offers.intervalUpgrade).toBe(false);
  });

  it("el estado `none` ofrece sus DOS salidas, y la baja va por `settle-free`", () => {
    const offers = subscriptionOffers(view({ plan: "none", status: "active" }));
    expect(offers.upgrade).toBe("Volver a Plus");
    expect(offers.downgrade).toEqual({
      label: "Ajustarme y bajar a Free",
      endpoint: "/api/billing/settle-free",
    });
  });

  it("las etiquetas salen de la allow-list, nunca el string crudo", () => {
    const offers = subscriptionOffers(
      view({ plan: "enterprise", status: "future_status" }),
    );
    expect([offers.plan, offers.status]).toEqual([
      "Plan no disponible",
      "en revisión",
    ]);
  });
});
