import { describe, expect, it } from "vitest";

import { applySubscriptionState } from "./billing";
import { stripeSubscription } from "./billing-integration-support";
import { txDouble } from "./billing-tx-double";

const BIZ = "11111111-1111-1111-1111-111111111111";
const subscription = stripeSubscription({
  id: "sub_1",
  customer: "cus_1",
});
const NOW = new Date("2026-10-10T12:00:00.000Z");

/**
 * Spec 0189 §D4 — LAS CAMPAÑAS SIGUEN AL ACCESO EN EL ACTO, del lado de «qué escribe».
 *
 * Acá se pinnea que la pausa sale de la MISMA llamada que escribe la fila (el doble sólo ve
 * una transacción), con qué columnas, y que la decide el acceso de la fila que QUEDÓ escrita
 * (lo que devuelve el `returning`). Que sea ATÓMICA es una propiedad de Postgres: su oráculo
 * es la integración con inyección de fallo (`billing-webhook-campaign-brake`). La reanudación
 * (que lee las campañas pausadas) tiene su oráculo en el barrido de integración (T9).
 */
describe("applySubscriptionState — el acceso que queda decide las campañas", () => {
  const write = {
    plan: "none",
    status: "canceled",
    pendingPlan: null,
    pendingPlanAt: null,
    clearDowngradeRequest: true,
  };

  it("si la fila queda SIN acceso, pausa TODAS las activas con `billing_blocked`", async () => {
    const { tx, recorded } = txDouble({
      plan: "none",
      status: "canceled",
      stripeSubscriptionId: "sub_1",
      trialEndsAt: new Date(NOW.getTime() - 1),
    });
    await applySubscriptionState(tx, {
      businessId: BIZ,
      subscription,
      write,
      lastEventAt: null,
      now: NOW,
    });
    expect(recorded.sets.campaign).toEqual({
      status: "paused",
      pauseReason: "billing_blocked",
      updatedAt: NOW,
    });
    // Y el plan se escribió igual: la pausa es un AÑADIDO, no un reemplazo.
    expect(recorded.set).toMatchObject({ plan: "none" });
  });

  it("si la fila queda CON acceso (la prueba vigente sobrevive), NO pausa nada", async () => {
    const { tx, recorded } = txDouble({
      plan: "trial",
      status: "canceled",
      stripeSubscriptionId: "sub_1",
      trialEndsAt: new Date(NOW.getTime() + 1),
    });
    await applySubscriptionState(tx, {
      businessId: BIZ,
      subscription,
      write: { ...write, plan: undefined },
      lastEventAt: null,
      now: NOW,
    });
    expect(recorded.sets).not.toHaveProperty("campaign");
  });

  it("una suscripción viva (aunque `past_due`) no pausa nada", async () => {
    const { tx, recorded } = txDouble({
      plan: "plus",
      status: "past_due",
      stripeSubscriptionId: "sub_1",
      trialEndsAt: null,
    });
    await applySubscriptionState(tx, {
      businessId: BIZ,
      subscription,
      write: { ...write, status: "past_due", clearDowngradeRequest: false },
      lastEventAt: null,
      now: NOW,
    });
    expect(recorded.sets).not.toHaveProperty("campaign");
  });
});
