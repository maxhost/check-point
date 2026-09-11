import { describe, expect, it } from "vitest";
import { LocationError } from "./locations";
import { limitReached, planLocationLimit } from "./locations/shared";

/**
 * Spec 0063, D2 / [R2] — el MENSAJE del tope y el MOTIVO por el que vale lo que vale.
 *
 * Vive fuera de `locations.test.ts` sólo por el límite de 300 líneas del repo (ese archivo
 * ya está en 229): mismo dominio, misma spec, "dividir, no extender".
 *
 * Existe porque un revisor independiente demostró que la rama `pendingDowngrade` de
 * `limitReached` no tenía NINGÚN oráculo: anulándola (`if (false && cap.pendingDowngrade)`)
 * la suite entera quedaba verde —integración Neon incluida— con «Tu plan permite 1 local
 * activo. Mejora tu plan para abrir otro» de vuelta sobre una baja ya programada, que es el
 * texto que [R2] existe para eliminar (manda al owner a la acción CONTRARIA).
 *
 * Lo que estas tablas NO pinnean, dicho acá y no en ningún lado más:
 *  - el CABLEADO: que `address.ts:43` y `store.ts:71` le pasen a `limitReached` el `cap`
 *    que salió de `planLocationLimit` bajo `lockBusiness`. Eso es integración y es fase B.
 *  - el SQL: el `tx` de abajo es un DOBLE. Fija la DERIVACIÓN de `pendingDowngrade` y las
 *    COLUMNAS que la lectura pide, no que Postgres devuelva esa fila. **Entre lo invisible
 *    está el `where` por `businessId`**: el doble ignora la condición, así que una lectura que
 *    trajera la suscripción de OTRO negocio pasaría estas tablas enteras. Dónde SÍ está
 *    cubierto, verificado por el revisor de la fase A sacando `.where(eq(businessId))`: este
 *    unit queda VERDE y la integración Neon se pone en **6 rojos**.
 */

type Chain = {
  from: () => Chain;
  where: () => Chain;
  limit: () => Promise<unknown[]>;
};

/** Doble del `tx`: `select(cols).from().where().limit()` → la fila sembrada, o ninguna. */
function capTx(row?: { plan: string | null; pendingPlan: string | null }) {
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

describe("locations — el mensaje del tope (spec 0063, D2 [R2])", () => {
  it("con una baja programada NO manda a «Mejora tu plan»", () => {
    const message = limitReached({ limit: 1, pendingDowngrade: true }).message;
    expect(message).not.toContain("Mejora tu plan");
    expect(message).toContain("baja a Free");
    expect(message).toContain("Reanuda");
  });

  it("SIN baja programada, el tope 1 SÍ manda a mejorar el plan", () => {
    // No es decorativa: sin esta fila, un mensaje ÚNICO para los dos casos pasaría el test
    // de arriba y la rama volvería a quedar sin oráculo.
    expect(
      limitReached({ limit: 1, pendingDowngrade: false }).message,
    ).toContain("Mejora tu plan");
  });

  it("las dos ramas comparten `status` y `code`: la distinción es de COPY", () => {
    for (const pendingDowngrade of [true, false]) {
      const error = limitReached({ limit: 1, pendingDowngrade });
      expect(error).toBeInstanceOf(LocationError);
      expect([error.status, error.code]).toEqual([409, "location_limit"]);
    }
  });
});

describe("locations — `pendingDowngrade` es «el pendiente BAJA el tope»", () => {
  it.each<[string | null, string | null, number, boolean]>([
    ["plus", "free", 1, true],
    ["plus", null, 3, false],
    ["plus", "", 3, false],
    // Hay un pendiente y NO baja el número: `pendingDowngrade` es FALSO. Es exactamente la
    // distinción que declara el comentario de `ActiveLocationCap`, y la que nadie aseveraba:
    // con «hay un pendiente» a secas, estas tres filas darían `true` y un negocio `free` que
    // programó algo leería «Tu suscripción baja a Free» sin tener de dónde bajar.
    ["free", "free", 1, false],
    ["free", "plus", 1, false],
    ["none", "free", 1, false],
  ])(
    "plan %s + pendiente %s → tope %i, pendingDowngrade %s",
    async (plan, pendingPlan, limit, pendingDowngrade) => {
      const { tx } = capTx({ plan, pendingPlan });
      expect(await planLocationLimit(tx, "biz-1")).toEqual({
        limit,
        pendingDowngrade,
      });
    },
  );

  it("sin fila de suscripción: tope 1 y ninguna baja programada", async () => {
    const { tx, selected } = capTx();
    expect(await planLocationLimit(tx, "biz-1")).toEqual({
      limit: 1,
      pendingDowngrade: false,
    });
    // D2 exige que la lectura pida `plan` Y `pendingPlan`. Sin esta aserción el doble
    // taparía que la query dejara de pedir la segunda columna: le entrega la fila igual.
    expect(selected.sort()).toEqual(["pendingPlan", "plan"]);
  });
});
