import { describe, expect, it } from "vitest";
import { campaignsAllowedFor, type CampaignPlanRow } from "./plan-gate";

/**
 * Spec 0065, fase D — las TRES condiciones del gate de plan de campañas, cada una con su
 * caso y con su control. El oráculo es la tabla: se escribe la salida esperada de cada
 * fila, no una regla re-derivada.
 *
 * Lo que NO está acá: que el 402 salga por HTTP y que el plan se lea AL ACTIVAR (los dos sí
 * tienen su oráculo en `marketing-campaign-actions.neon.integration.test.ts`).
 *
 * Y UNA ATRIBUCIÓN QUE ERA FALSA, corregida: este docblock decía que «el gate se lee en la
 * MISMA transacción que escribe» tenía su oráculo en esa integración. **No lo tiene** — la
 * revisión independiente de la fase D leyó el gate con `getDb()` fuera de la transacción y
 * los 64 tests quedaron VERDES. La ventana es real pero angosta (deja crear un `draft` que
 * después no se puede activar), así que se DECLARA sin oráculo en vez de perseguirla. Lo que
 * no se podía dejar es la frase: una fila «propiedad → su oráculo vive allá» escrita de
 * memoria le regala a quien herede el árbol una cobertura que no existe.
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
