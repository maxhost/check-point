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
 * **Los valores se transcriben a mano** (`1`, `3`, `"day"`): un test que leyera
 * `ENTITLEMENTS["catalog.imports.analyses"].byPlan.free` pasaria con CUALQUIER valor, que es
 * exactamente la copia muerta que `entitlements-catalog.test.ts` ya descarta.
 */
const live = (plan: string): EntitlementContext => ({
  plan,
  status: "active",
  stripeSubscriptionId: "sub_live",
});

describe("entitlements — el cupo de importación de catálogo", () => {
  it("arranca en UN análisis por negocio por día, en los tres planes", () => {
    expect(limitOf({ plan: "free" }, "catalog.imports.analyses")).toBe(1);
    expect(limitOf({ plan: "plus" }, "catalog.imports.analyses")).toBe(1);
    expect(limitOf({ plan: "none" }, "catalog.imports.analyses")).toBe(1);
    expect(windowOf("catalog.imports.analyses")).toBe("day");
  });

  it("el techo de intentos al proveedor es 3 por día", () => {
    expect(limitOf({ plan: "free" }, "catalog.imports.attempts")).toBe(3);
    expect(limitOf({ plan: "plus" }, "catalog.imports.attempts")).toBe(3);
    expect(limitOf({ plan: "none" }, "catalog.imports.attempts")).toBe(3);
    expect(windowOf("catalog.imports.attempts")).toBe("day");
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
    ).toBe(1);
    expect(limitOf(live("plus"), "catalog.imports.analyses")).toBe(1);
  });

  it("un plan desconocido cae al fallback, no a cero ni a infinito", () => {
    expect(limitOf({ plan: "enterprise" }, "catalog.imports.analyses")).toBe(1);
    expect(limitOf({ plan: null }, "catalog.imports.attempts")).toBe(3);
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
