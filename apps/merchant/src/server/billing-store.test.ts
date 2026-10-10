import { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  applySubscriptionState,
  clearPendingPlan,
  readSubscription,
  scheduleCancel,
} from "./billing";
import { stripeSubscription } from "./billing-integration-support";
import { txDouble } from "./billing-tx-double";

/**
 * Spec 0063 — `billing/store.ts`: QUÉ COLUMNAS TOCA CADA OPERACIÓN.
 *
 * El `tx` de acá es un DOBLE, igual que el de `locations-plan-cap.test.ts`: fija el conjunto
 * EXACTO de claves de cada `SET` y del `select`, no que Postgres aplique la fila. Lo que
 * queda afuera está declarado al pie del archivo y sí tiene oráculo, en
 * `billing-store.neon.integration.test.ts`.
 *
 * Por qué el conjunto de claves y no sólo los valores: la propiedad load-bearing puede ser
 * una AUSENCIA (cancelar NO toca el plan). Un test de valores no ve una clave que sobra; uno
 * de conjunto, sí.
 */

const BIZ = "11111111-1111-1111-1111-111111111111";

describe("scheduleCancel — la cancelación programada (spec 0189 §D7)", () => {
  it("escribe `pending_plan`, su fecha y la marca de auditoría, y nada más", async () => {
    const at = new Date(Date.UTC(2026, 11, 1));
    const { tx, recorded } = txDouble();
    await scheduleCancel(tx, BIZ, {
      now: new Date(Date.UTC(2026, 9, 10)),
      pendingPlan: "none",
      pendingPlanAt: at,
    });
    expect(Object.keys(recorded.set).sort()).toEqual([
      "downgradeRequestedAt",
      "pendingPlan",
      "pendingPlanAt",
      "updatedAt",
    ]);
    expect(recorded.set).toMatchObject({
      pendingPlan: "none",
      pendingPlanAt: at,
    });
    // NO toca el plan: se usa lo pagado hasta el fin del periodo (ADR 0134 §8).
    expect(recorded.set).not.toHaveProperty("plan");
  });

  it("`downgrade_requested_at` se escribe con un `coalesce`: conserva la primera marca", async () => {
    const { tx, recorded } = txDouble();
    await scheduleCancel(tx, BIZ, {
      now: new Date(),
      pendingPlan: "none",
      pendingPlanAt: null,
    });
    expect(recorded.set.downgradeRequestedAt).toBeInstanceOf(SQL);
  });
});

describe("clearPendingPlan — el revert limpia las TRES columnas", () => {
  it("no deja `downgrade_requested_at` puesto", async () => {
    // Su llamador es `resume` (spec 0189 §D7): deshacer la cancelación limpia las tres
    // juntas, o la UI seguiría diciendo «tu suscripción termina el …».
    const { tx, recorded } = txDouble();
    await clearPendingPlan(tx, BIZ);
    expect(recorded.set).toMatchObject({
      pendingPlan: null,
      pendingPlanAt: null,
      downgradeRequestedAt: null,
    });
    expect(Object.keys(recorded.set).sort()).toEqual([
      "downgradeRequestedAt",
      "pendingPlan",
      "pendingPlanAt",
      "updatedAt",
    ]);
  });
});

describe("applySubscriptionState — `plan` AUSENTE significa «no tocar el plan»", () => {
  const subscription = stripeSubscription({
    id: "sub_1",
    customer: "cus_1",
  });

  it("sin `plan` en el write, la columna `plan` NO entra en el `SET`", async () => {
    // El caso más frecuente (`past_due`, `incomplete`, `unpaid`, `paused`, price o status
    // desconocido). Si entrara como `undefined`, drizzle no la escribiría igual — pero si
    // alguien la tradujera a `null`, el negocio quedaría sin plan por un impago, que es justo
    // lo que el ADR 0059 prohíbe.
    const { tx, recorded } = txDouble();
    await applySubscriptionState(tx, {
      businessId: BIZ,
      subscription,
      write: {
        status: "past_due",
        pendingPlan: null,
        pendingPlanAt: null,
        clearDowngradeRequest: false,
      },
      lastEventAt: null,
    });
    expect(recorded.set).not.toHaveProperty("plan");
    expect(recorded.set).not.toHaveProperty("interval");
    expect(recorded.set).not.toHaveProperty("downgradeRequestedAt");
    expect(recorded.set).not.toHaveProperty("lastEventAt");
    expect(recorded.set).toMatchObject({
      status: "past_due",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
  });

  it("con `clearDowngradeRequest` la marca se limpia, y sólo entonces", async () => {
    const { tx, recorded } = txDouble();
    await applySubscriptionState(tx, {
      businessId: BIZ,
      subscription,
      write: {
        plan: "none",
        status: "canceled",
        pendingPlan: null,
        pendingPlanAt: null,
        clearDowngradeRequest: true,
      },
      lastEventAt: new Date(Date.UTC(2026, 8, 10)),
    });
    expect(recorded.set).toMatchObject({
      plan: "none",
      downgradeRequestedAt: null,
      lastEventAt: new Date(Date.UTC(2026, 8, 10)),
    });
  });
});

describe("readSubscription — la allow-list de columnas", () => {
  it("pide las 11 columnas del dominio, ni una más ni una menos", async () => {
    // Sin esta aserción, que la lectura dejara de pedir `trialEndsAt` pasaría desapercibido:
    // el eje de acceso lo leería como `undefined` y el estado de cobro mentiría.
    const { tx, recorded } = txDouble({ businessId: BIZ });
    await readSubscription(tx, BIZ);
    expect(recorded.selected.sort()).toEqual([
      "businessId",
      "downgradeRequestedAt",
      "interval",
      "lastEventAt",
      "pendingPlan",
      "pendingPlanAt",
      "plan",
      "status",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "trialEndsAt",
    ]);
  });

  it("sin fila devuelve `null`, no `undefined`", async () => {
    const { tx } = txDouble();
    expect(await readSubscription(tx, BIZ)).toBeNull();
  });
});

/**
 * LO QUE ESTE ARCHIVO NO PINNEA, declarado en vez de tapado:
 *
 *  - que el `coalesce` de `scheduleCancel` CONSERVE de verdad la marca anterior: eso es
 *    Postgres (`billing-store.neon.integration.test.ts`);
 *  - el `where` por `businessId` de cada `UPDATE`: el doble ignora el `where`, así que una
 *    operación que escribiera sobre TODAS las filas pasaría estos tests. Mismo límite que
 *    declara `locations-plan-cap.test.ts`, y está cubierto en la integración, donde las dos
 *    suscripciones del mundo de prueba son de negocios distintos;
 *  - `reconcileFromStripe`, que abre su propia transacción y no acepta un doble: su oráculo es
 *    `billing-store.neon.integration.test.ts` (incluida M16, «con la lista vacía no escribe
 *    nada»).
 */
