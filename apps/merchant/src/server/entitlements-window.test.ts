import { describe, expect, it } from "vitest";
import {
  limitOf,
  retryAfterSeconds,
  windowEnd,
  windowOf,
  windowStart,
  type EntitlementContext,
} from "./entitlements";

/**
 * Spec 0090 §8 / ADR 0082 §10 — EL CUPO DE ANALISIS COMO VALOR DEL CATALOGO, con ventana.
 *
 * **Los valores se transcriben a mano** (`100`, `"day"`): un test que leyera
 * `ENTITLEMENTS["catalog.imports.analyses"].byPlan.free` pasaria con CUALQUIER valor, que es
 * exactamente la copia muerta que `entitlements-catalog.test.ts` ya descarta.
 *
 * **Los dos topes estan en VALOR DE PRUEBAS (100).** Los de produccion son **1** analisis y
 * **3** intentos por dia; cuando vuelvan, estas transcripciones vuelven con ellos — que es
 * precisamente el punto de transcribirlas.
 */
const live = (plan: string): EntitlementContext => ({
  plan,
  status: "active",
  stripeSubscriptionId: "sub_live",
});

describe("entitlements — el cupo de importación de catálogo", () => {
  it("está en 100 análisis por negocio por día (pruebas), en los tres planes", () => {
    expect(limitOf({ plan: "free" }, "catalog.imports.analyses")).toBe(100);
    expect(limitOf({ plan: "plus" }, "catalog.imports.analyses")).toBe(100);
    expect(limitOf({ plan: "none" }, "catalog.imports.analyses")).toBe(100);
    expect(windowOf("catalog.imports.analyses")).toBe("day");
  });

  it("el techo de intentos al proveedor es 100 por día (pruebas)", () => {
    expect(limitOf({ plan: "free" }, "catalog.imports.attempts")).toBe(100);
    expect(limitOf({ plan: "plus" }, "catalog.imports.attempts")).toBe(100);
    expect(limitOf({ plan: "none" }, "catalog.imports.attempts")).toBe(100);
    expect(windowOf("catalog.imports.attempts")).toBe("day");
  });

  /**
   * **La ventana sigue siendo `day` y el cupo sigue EXISTIENDO.** Subirlo a 100 no es lo
   * mismo que apagarlo: `assertQuota` sigue contando y sigue tirando `429` al agotarse.
   * Este caso es el que se romperia si alguien «sacara el limite» poniendo `0`, `Infinity`
   * o borrando la clave.
   */
  it("el cupo NO quedó apagado: sigue siendo un número finito y positivo", () => {
    for (const key of [
      "catalog.imports.analyses",
      "catalog.imports.attempts",
    ] as const) {
      const limite = limitOf({ plan: "free" }, key);
      expect(Number.isFinite(limite)).toBe(true);
      expect(limite).toBeGreaterThan(0);
    }
  });

  /**
   * **NO es cuota comercial** (ADR 0082 §7 sigue en pie). Si exigiera suscripción viva, un
   * negocio sin pagar no podría importar su menú — que es justo el negocio que estrena la
   * feature.
   */
  it("NO exige suscripción viva: un `plus` forma A1 importa igual", () => {
    expect(
      limitOf(
        {
          plan: "plus",
          status: "incomplete_expired",
          stripeSubscriptionId: null,
        },
        "catalog.imports.analyses",
      ),
    ).toBe(100);
    expect(limitOf(live("plus"), "catalog.imports.analyses")).toBe(100);
  });

  it("un plan desconocido cae al fallback, no a cero ni a infinito", () => {
    expect(limitOf({ plan: "enterprise" }, "catalog.imports.analyses")).toBe(
      100,
    );
    expect(limitOf({ plan: null }, "catalog.imports.attempts")).toBe(100);
  });

  it("`locations.max` NO tiene ventana: es un tope de stock, no de flujo", () => {
    expect(windowOf("locations.max")).toBeNull();
  });
});

describe("la ventana, como aritmética pura", () => {
  const en = (iso: string) => new Date(iso);

  it("`day` arranca a medianoche UTC del mismo día", () => {
    expect(
      windowStart("day", en("2026-09-22T23:59:59.999Z")).toISOString(),
    ).toBe("2026-09-22T00:00:00.000Z");
    expect(windowEnd("day", en("2026-09-22T10:00:00.000Z")).toISOString()).toBe(
      "2026-09-23T00:00:00.000Z",
    );
  });

  it("`week` arranca el LUNES, y un domingo pertenece a la semana que ya empezó", () => {
    // 2026-09-22 es martes; 2026-09-20 es domingo.
    expect(
      windowStart("week", en("2026-09-22T10:00:00.000Z")).toISOString(),
    ).toBe("2026-09-21T00:00:00.000Z");
    expect(
      windowStart("week", en("2026-09-20T10:00:00.000Z")).toISOString(),
    ).toBe("2026-09-14T00:00:00.000Z");
  });

  it("`month` arranca el día 1 y cruza el fin de año sin romperse", () => {
    expect(
      windowStart("month", en("2026-09-30T23:00:00.000Z")).toISOString(),
    ).toBe("2026-09-01T00:00:00.000Z");
    expect(
      windowEnd("month", en("2026-12-15T00:00:00.000Z")).toISOString(),
    ).toBe("2027-01-01T00:00:00.000Z");
  });

  it("`retryAfterSeconds` cuenta hasta que el cupo se repone, y NUNCA es 0", () => {
    expect(retryAfterSeconds("day", en("2026-09-22T12:00:00.000Z"))).toBe(
      43_200,
    );
    // Un milisegundo antes del corte: el redondeo tiene que dar 1, no 0.
    expect(retryAfterSeconds("day", en("2026-09-22T23:59:59.999Z"))).toBe(1);
  });
});
