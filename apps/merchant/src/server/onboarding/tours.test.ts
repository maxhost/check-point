import { describe, expect, it } from "vitest";

import {
  ONBOARDING_TOURS,
  TOUR_STATUSES,
  isOnboardingTourId,
  isTourStatus,
} from "./tours";

/**
 * Spec 0084 — EL CATALOGO DE TOURS, que es la FUENTE DE VERDAD de qué ids acepta la escritura
 * y de qué items va a derivar la spec 0085.
 *
 * Acá no hay base ni HTTP: lo que se mide es el conjunto CERRADO y sus dos validadores. El
 * `404 unknown_tour` sobre la ruta —que es lo que esto habilita— tiene su oráculo contra Neon.
 */
describe("el catálogo de tours del onboarding (spec 0084 §D2)", () => {
  /**
   * CONJUNTO EXACTO, no `toContain`. Con un `toContain` un quinto id entraría sin que nadie lo
   * vea, y la 0085 derivaría un item de más; con un `length >= 4`, uno de menos no pondría rojo
   * a nadie hasta que un merchant se trabara en un tour que la API rechaza con 404.
   */
  it("son EXACTAMENTE los cinco ids, y en ese orden", () => {
    // `locations` entro el 2026-09-21 y va PRIMERO: el orden de esta constante es el que el
    // checklist publica como `position`.
    expect([...ONBOARDING_TOURS]).toEqual([
      "locations",
      "staff",
      "catalog",
      "program",
      "brand",
    ]);
  });

  it("los cinco validan como `tourId`", () => {
    for (const tour of ONBOARDING_TOURS)
      expect(isOnboardingTourId(tour)).toBe(true);
  });

  /**
   * Un id desconocido NO valida — es lo que hace que la escritura sea fail-closed. Las
   * entradas cubren las tres formas en que esto se rompe en la práctica: un id inventado, uno
   * que se parece por prefijo/caso, y un no-string que llegue de un `params` deformado.
   */
  it.each([
    "tour-inventado",
    "staff ",
    "Staff",
    "STAFF",
    "",
    "catalogo",
    "programa",
    null,
    undefined,
    42,
    ["staff"],
    { tourId: "staff" },
  ])("un `tourId` desconocido (%o) no valida", (value) => {
    expect(isOnboardingTourId(value)).toBe(false);
  });

  it("los dos estados del ADR 0078 §2 son EXACTAMENTE `completed` y `skipped`", () => {
    expect([...TOUR_STATUSES]).toEqual(["completed", "skipped"]);
    expect(isTourStatus("completed")).toBe(true);
    expect(isTourStatus("skipped")).toBe(true);
  });

  /**
   * Un `status` fuera de los dos valores EXACTOS no valida. `done`, `true` y `"skip"` son las
   * tres cosas que una UI escribe por error; `"Completed"` es la que un `CHECK` de la base
   * rechazaría con un 503 ilegible si la ruta la dejara pasar.
   */
  it.each([
    "done",
    "skip",
    "Completed",
    "SKIPPED",
    " completed",
    "",
    true,
    null,
    undefined,
    1,
    ["completed"],
  ])("un `status` fuera de los dos valores (%o) no valida", (value) => {
    expect(isTourStatus(value)).toBe(false);
  });
});
