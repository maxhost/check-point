import { describe, expect, it } from "vitest";
import { LocationError } from "./locations";
import { limitReached, planLocationLimit } from "./locations/shared";

/**
 * Spec 0063 D2 + spec 0189 §D2 — el MENSAJE del tope y la LECTURA del tope efectivo.
 *
 * Vive fuera de `locations.test.ts` sólo por el límite de 300 líneas del repo.
 *
 * Lo que estas tablas NO pinnean:
 *  - el CABLEADO: que `address.ts` y `store.ts` le pasen a `limitReached` el `cap` que salió
 *    de `planLocationLimit` bajo `lockBusiness` (integración).
 *  - el SQL: el `tx` de abajo es un DOBLE. Fija las COLUMNAS que la lectura pide y la
 *    derivación, no que Postgres devuelva esa fila (ni el `where` por `businessId`).
 */

type Chain = {
  from: () => Chain;
  where: () => Chain;
  limit: () => Promise<unknown[]>;
};

/** Doble del `tx`: `select(cols).from().where().limit()` → la fila sembrada, o ninguna. */
function capTx(row?: Record<string, unknown>) {
  const selected: string[] = [];
  const chain: Chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(row ? [row] : []),
  };
  const tx = {
    select: (columns: Record<string, unknown>) => {
      selected.push(...Object.keys(columns));
      return chain;
    },
  } as unknown as Parameters<typeof planLocationLimit>[0];
  return { tx, selected };
}

const NOW = new Date("2026-10-10T12:00:00.000Z");

describe("locations — el mensaje del tope", () => {
  it("con tope 1 manda a mejorar el plan", () => {
    expect(limitReached({ limit: 1 }).message).toBe(
      "Tu plan permite 1 local activo. Mejora tu plan para abrir otro.",
    );
  });

  it("con tope 3 dice el número", () => {
    const error = limitReached({ limit: 3 });
    expect(error).toBeInstanceOf(LocationError);
    expect([error.status, error.code, error.message]).toEqual([
      409,
      "location_limit",
      "Tu plan permite 3 locales activos.",
    ]);
  });
});

describe("locations — `planLocationLimit` lee el eje de acceso", () => {
  it("una prueba vigente da 3 y una vencida 1", async () => {
    const base = {
      plan: "trial",
      status: "active",
      stripeSubscriptionId: null,
    };
    const vigente = capTx({
      ...base,
      trialEndsAt: new Date(NOW.getTime() + 1),
    });
    expect(await planLocationLimit(vigente.tx, "biz-1", NOW)).toEqual({
      limit: 3,
    });
    const vencida = capTx({ ...base, trialEndsAt: NOW });
    expect(await planLocationLimit(vencida.tx, "biz-1", NOW)).toEqual({
      limit: 1,
    });
  });

  it("una cancelación programada NO baja el tope (ADR 0134 §8)", async () => {
    const { tx } = capTx({
      plan: "plus",
      status: "active",
      stripeSubscriptionId: "sub_1",
      trialEndsAt: null,
      pendingPlan: "none",
    });
    expect(await planLocationLimit(tx, "biz-1", NOW)).toEqual({ limit: 3 });
  });

  it("sin fila de suscripción: tope 1, y pide las cuatro columnas del eje", async () => {
    const { tx, selected } = capTx();
    expect(await planLocationLimit(tx, "biz-1", NOW)).toEqual({ limit: 1 });
    // Sin esta aserción el doble taparía que la query dejara de pedir una columna: le
    // entrega la fila igual.
    expect(selected.sort()).toEqual([
      "plan",
      "status",
      "stripeSubscriptionId",
      "trialEndsAt",
    ]);
  });
});
