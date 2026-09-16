import { describe, expect, it } from "vitest";
import { campaignsAllowedFor, type CampaignPlanRow } from "./plan-gate";

/**
 * Spec 0065, fase D — las TRES condiciones del gate de plan de campañas, cada una con su
 * caso y con su control. El oráculo es la tabla: se escribe la salida esperada de cada
 * fila, no una regla re-derivada.
 *
 * Lo que NO está acá y tiene su oráculo en la integración
 * (`marketing-campaign-actions.neon.integration.test.ts`): que el gate se lea en la MISMA
 * transacción que escribe, y que el 402 salga por HTTP.
 */

const live: CampaignPlanRow = {
  plan: "plus",
  pendingPlan: null,
  status: "active",
  stripeSubscriptionId: "sub_1",
};

const CASES: Array<[string, Partial<CampaignPlanRow>, boolean]> = [
  ["plus con suscripción viva", {}, true],
  ["plus en trial (no es un status MUERTO)", { status: "trialing" }, true],
  [
    "plus en `past_due` — el impago bloquea el acceso, no degrada",
    { status: "past_due" },
    true,
  ],
  ["plus con un `pending_plan` que NO baja", { pendingPlan: "plus" }, true],
  [
    "plus con `pending_plan` vacío: eso no es una baja programada",
    { pendingPlan: "" },
    true,
  ],
  ["free", { plan: "free" }, false],
  ["none", { plan: "none" }, false],
  ["un plan desconocido", { plan: "enterprise" }, false],
  ["plus con baja programada a free", { pendingPlan: "free" }, false],
  [
    "plus SIN `stripe_subscription_id` (la fila A1 de prod)",
    { stripeSubscriptionId: null },
    false,
  ],
  ["plus con la suscripción cancelada", { status: "canceled" }, false],
  [
    "plus con la suscripción `incomplete_expired`",
    { status: "incomplete_expired" },
    false,
  ],
];

describe("campaignsAllowedFor — el gate de plan de las campañas (spec 0065, fase D)", () => {
  it.each(CASES)("%s → %s", (_label, over, expected) => {
    expect(campaignsAllowedFor({ ...live, ...over })).toBe(expected);
  });

  it("sin fila de suscripción NO hay campañas", () => {
    // Un negocio sin fila no debería existir (el unique + la fk de D3), pero el default de
    // un `select` que no encuentra nada es `undefined`, y el default seguro acá es `false`:
    // lo contrario regalaría el plan Plus a un estado que nadie sabe leer.
    expect(campaignsAllowedFor(null)).toBe(false);
  });

  it("la tabla ejerce las dos salidas (no es degenerada)", () => {
    const outcomes = new Set(CASES.map(([, , expected]) => expected));
    expect([...outcomes].sort()).toEqual([false, true]);
    expect(CASES).toHaveLength(12);
  });
});
