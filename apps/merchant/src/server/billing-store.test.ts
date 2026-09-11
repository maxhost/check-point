import { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  applySubscriptionState,
  clearPendingPlan,
  readSubscription,
  scheduleDowngrade,
  settleToFree,
} from "./billing";
import type { DbTransaction } from "./db";
import { stripeSubscription } from "./billing-integration-support";

/**
 * Spec 0063 — `billing/store.ts`: QUÉ COLUMNAS TOCA CADA OPERACIÓN.
 *
 * El `tx` de acá es un DOBLE, igual que el de `locations-plan-cap.test.ts`: fija el conjunto
 * EXACTO de claves de cada `SET` y del `select`, no que Postgres aplique la fila. Lo que
 * queda afuera está declarado al pie del archivo y sí tiene oráculo, en
 * `billing-store.neon.integration.test.ts`.
 *
 * Por qué el conjunto de claves y no sólo los valores: en D10 la propiedad load-bearing es
 * una AUSENCIA — `stripe_customer_id` SE CONSERVA, porque es la llave con la que D8 vuelve a
 * preguntarle a Stripe. Un test de valores no ve una clave que sobra; uno de conjunto, sí.
 */

type Recorded = {
  set: Record<string, unknown>;
  selected: string[];
};

function txDouble(row?: Record<string, unknown>) {
  const recorded: Recorded = { set: {}, selected: [] };
  const chain = {
    set: (values: Record<string, unknown>) => {
      recorded.set = values;
      return chain;
    },
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(row ? [row] : []),
    returning: () => Promise.resolve(row ? [row] : []),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve([])),
  };
  const tx = {
    update: () => chain,
    select: (columns: Record<string, unknown>) => {
      recorded.selected = Object.keys(columns);
      return chain;
    },
  } as unknown as DbTransaction;
  return { tx, recorded };
}

const BIZ = "11111111-1111-1111-1111-111111111111";

describe("settleToFree — el `SET` exacto de D10", () => {
  it("escribe las 7 columnas de la spec y NO `stripe_customer_id`", async () => {
    const { tx, recorded } = txDouble();
    await settleToFree(tx, BIZ, new Date(Date.UTC(2026, 8, 10)));
    expect(Object.keys(recorded.set).sort()).toEqual([
      "downgradeRequestedAt",
      "interval",
      "pendingPlan",
      "pendingPlanAt",
      "plan",
      "status",
      "stripeSubscriptionId",
      "updatedAt",
    ]);
    // `stripe_customer_id` NO está: es la llave de D8 y borrarla deja al negocio sin forma
    // de detectar deriva. Se asevera como ausencia, que es la propiedad real.
    expect(recorded.set).not.toHaveProperty("stripeCustomerId");
  });

  it("limpia el id de Stripe y el intervalo, y deja `free` / `active`", async () => {
    // Los cuatro valores que hacen que el negocio PUEDA volver a Plus: con
    // `status='active'` y el `stripe_subscription_id` viejo sin limpiar,
    // `hasLiveSubscription` es true → `subscription_live` 409 PARA SIEMPRE.
    const { tx, recorded } = txDouble();
    await settleToFree(tx, BIZ);
    expect(recorded.set).toMatchObject({
      plan: "free",
      status: "active",
      stripeSubscriptionId: null,
      interval: null,
      pendingPlan: null,
      pendingPlanAt: null,
      downgradeRequestedAt: null,
    });
  });
});

describe("scheduleDowngrade — la intención, y la marca que NO se pisa", () => {
  it("el paso 2 de D6 escribe `pending_plan` y NO toca `pending_plan_at`", async () => {
    // «Baja programada SIN fecha» es un estado VÁLIDO y garantizado entre el 200 de `cancel`
    // y el paso 4 (D7 lo muestra sin fecha). Si el paso 2 escribiera `pendingPlanAt: null`,
    // un segundo `cancel` borraría la fecha que el paso 4 ya había puesto.
    const { tx, recorded } = txDouble({ downgradeRequestedAt: null });
    await scheduleDowngrade(tx, BIZ, { now: new Date(Date.UTC(2026, 8, 10)) });
    expect(Object.keys(recorded.set).sort()).toEqual([
      "downgradeRequestedAt",
      "pendingPlan",
      "updatedAt",
    ]);
    expect(recorded.set.pendingPlan).toBe("free");
  });

  it("`downgrade_requested_at` se escribe con un `coalesce`, no con la fecha pelada", async () => {
    // La propiedad: CONSERVA la marca que ya estuviera puesta. De eso cuelga la
    // `idempotencyKey` de D6 (`billing:cancel:${id}:${downgradeRequestedAt}`): si cada
    // reintento la sobreescribiera con `now()`, la clave cambiaría y Stripe no reconocería
    // el reintento — el camino de reparación dejaría de serlo. Que el `coalesce` haga lo que
    // dice se verifica en la integración, por SQL; acá se asevera que la decisión es un
    // `coalesce` y no una asignación.
    const { tx, recorded } = txDouble({ downgradeRequestedAt: null });
    await scheduleDowngrade(tx, BIZ, { now: new Date() });
    expect(recorded.set.downgradeRequestedAt).toBeInstanceOf(SQL);
  });

  it("el paso 4 sí escribe `pending_plan_at` cuando llega la fecha de Stripe", async () => {
    const cancelAt = new Date(Date.UTC(2026, 11, 1));
    const { tx, recorded } = txDouble({ downgradeRequestedAt: null });
    await scheduleDowngrade(tx, BIZ, {
      now: new Date(),
      pendingPlanAt: cancelAt,
    });
    expect(recorded.set.pendingPlanAt).toBe(cancelAt);
  });
});

describe("clearPendingPlan — `resume` limpia las TRES columnas", () => {
  it("no deja `downgrade_requested_at` puesto", async () => {
    // Si `resume` dejara la marca, un `deleted` ajeno posterior se clasificaría «esperado» y
    // aterrizaría en `free` en vez de `none` — el bloqueante R2-1 por la puerta de atrás.
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
  it("pide las 10 columnas del dominio, ni una más ni una menos", async () => {
    // Sin esta aserción, que la lectura dejara de pedir `downgradeRequestedAt` pasaría
    // desapercibido: `planFromSubscription` lo leería como `undefined`, la comparación
    // `!== null` daría true y TODO `deleted` aterrizaría en `free` — el bloqueante R2-1 otra
    // vez, esta vez por una columna que nadie seleccionó.
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
 *  - que el `coalesce` de `scheduleDowngrade` CONSERVE de verdad la marca anterior: eso es
 *    Postgres, y su oráculo es `billing-store.neon.integration.test.ts`
 *    (`scheduleDowngrade CONSERVA downgrade_requested_at entre pedidos repetidos`);
 *  - el `where` por `businessId` de cada `UPDATE`: el doble ignora el `where`, así que una
 *    operación que escribiera sobre TODAS las filas pasaría estos tests. Mismo límite que
 *    declara `locations-plan-cap.test.ts`, y está cubierto en la integración, donde las dos
 *    suscripciones del mundo de prueba son de negocios distintos;
 *  - `reconcileFromStripe`, que abre su propia transacción y no acepta un doble: su oráculo es
 *    `billing-store.neon.integration.test.ts` (incluida M16, «con la lista vacía no escribe
 *    nada»).
 */
