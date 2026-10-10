import { describe, expect, it } from "vitest";
import {
  subscriptionOffers,
  type SubscriptionOffers,
  type SubscriptionView,
} from "./billing";

/**
 * Spec 0063 D7, reescrita por la spec 0189 §D9 — LAS OFERTAS DE LA SECCIÓN DE SUSCRIPCIÓN como
 * función pura, sobre los planes nuevos (`trial`/`base`/`plus`/`none`). Sin base y sin mocks.
 *
 * LO QUE NO PINNEA: el CABLEADO de la PÁGINA (`billing-pages.neon.integration.test.ts`).
 */

/**
 * LA TABLA, FILA POR FILA. El resumen colapsa LAS SEIS salidas en un string para que nada
 * quede sin aseverar: si la función empezara a ofrecer algo DE MÁS, el string cambia y la fila
 * se pone roja. Se compara contra un literal escrito a mano.
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
const CHOOSE = "Elegir un plan";

const view = (o: Partial<SubscriptionView> = {}): SubscriptionView => ({
  plan: "trial",
  status: "active",
  interval: null,
  pendingPlan: null,
  pendingPlanAt: null,
  trialEndsAt: AT,
  ...o,
});

describe("subscriptionOffers — la tabla como función pura (spec 0189)", () => {
  it.each([
    // plan, status, interval, pendingPlan, pendingPlanAt, resumen
    ["trial", "active", null, null, null, `${CHOOSE} - - - - -`],
    ["plus", "active", "month", null, null, "- cancel anual - - -"],
    ["plus", "active", "year", null, null, "- cancel - - - -"],
    ["base", "active", "month", null, null, "- cancel anual - - -"],
    ["base", "trialing", "year", null, null, "- cancel - - - -"],
    ["plus", "active", null, null, null, "- cancel anual - - -"],
    // Un plan pago con la suscripción MUERTA: no hay qué cancelar, se elige un plan.
    ["plus", "canceled", "month", null, null, `${CHOOSE} - - - - -`],
    ["base", "incomplete_expired", "month", null, null, `${CHOOSE} - - - - -`],
    ["none", "canceled", null, null, null, `${CHOOSE} - - - - sin-plan`],
    ["plus", "active", "month", "none", AT, "- - - with_date - -"],
    ["plus", "active", "month", "none", null, "- - - without_date - -"],
    ["plus", "past_due", "month", null, null, "- - - - cobro -"],
    ["base", "unpaid", "month", null, null, "- - - - cobro -"],
    ["plus", "past_due", "month", "none", AT, "- - - - cobro -"],
    ["plus", "active", "month", "", null, "- cancel anual - - -"],
    ["enterprise", "active", null, null, null, `${CHOOSE} - - - - -`],
    ["none", "active", null, "none", AT, "- - - with_date - -"],
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

  it("`past_due` con cancelación programada: gana el cobro y no ofrece NADA", () => {
    const offers = subscriptionOffers(
      view({ plan: "plus", status: "unpaid", pendingPlan: "none" }),
    );
    expect(offers.paymentPending).toBe(true);
    expect([offers.upgrade, offers.downgrade, offers.intervalUpgrade]).toEqual([
      null,
      null,
      false,
    ]);
    expect(offers.pendingDowngrade).toBeNull();
  });

  it("cancelar va por `cancel` y ya no dice «Free»", () => {
    const offers = subscriptionOffers(
      view({ plan: "plus", status: "active", interval: "month" }),
    );
    expect(offers.downgrade).toEqual({
      label: "Cancelar suscripción",
      endpoint: "/api/billing/cancel",
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
