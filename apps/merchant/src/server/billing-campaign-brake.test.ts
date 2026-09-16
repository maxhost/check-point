import { describe, expect, it } from "vitest";

import { applySubscriptionState } from "./billing";
import { stripeSubscription } from "./billing-integration-support";
import { txDouble } from "./billing-tx-double";

const BIZ = "11111111-1111-1111-1111-111111111111";
const subscription = stripeSubscription({
  id: "sub_1",
  customer: "cus_1",
});

/**
 * Spec 0065, fase D — EL FRENO DEFENSIVO, del lado de «qué escribe».
 *
 * Acá se pinnea que la pausa sale de la MISMA llamada que escribe el plan (el doble sólo ve
 * una transacción) y con qué columnas. Que sea ATÓMICA —que un fallo del `update` de
 * campañas deje el plan sin escribir— es una propiedad de Postgres y su oráculo es la
 * integración, con inyección de fallo; un doble no puede probar un rollback.
 */
describe("applySubscriptionState — el freno defensivo de campañas (spec 0065)", () => {
  const derived = (plan: string | undefined) => ({
    ...(plan === undefined ? {} : { plan }),
    status: "canceled",
    pendingPlan: null,
    pendingPlanAt: null,
    clearDowngradeRequest: false,
  });

  it.each(["free", "none"])(
    "con el plan derivado en `%s` pausa las campañas activas en la misma transacción",
    async (plan) => {
      const { tx, recorded } = txDouble();
      await applySubscriptionState(tx, {
        businessId: BIZ,
        subscription,
        write: derived(plan),
        lastEventAt: null,
      });
      expect(recorded.sets.campaign).toMatchObject({
        status: "paused",
        pauseReason: "plan_downgraded",
      });
      // Y el plan se escribió igual: la pausa es un AÑADIDO, no un reemplazo.
      expect(recorded.set).toMatchObject({ plan });
    },
  );

  const UNTOUCHED: Array<[string | undefined, string]> = [
    ["plus", "un plan que no baja"],
    [undefined, "«no tocar el plan» (`past_due`, price desconocido…)"],
  ];

  it.each(UNTOUCHED)("con %s (%s) NO toca ninguna campaña", async (plan) => {
    const { tx, recorded } = txDouble();
    await applySubscriptionState(tx, {
      businessId: BIZ,
      subscription,
      write: derived(plan),
      lastEventAt: null,
    });
    expect(recorded.sets).not.toHaveProperty("campaign");
  });
});
