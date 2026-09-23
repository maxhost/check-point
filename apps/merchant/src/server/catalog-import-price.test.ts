import { describe, expect, it } from "vitest";
import { matchKey, parsePriceText } from "./catalog-import/plan";

/**
 * Spec 0091 §2/§4 — LA CLAVE CANONICA Y EL PARSEO DEL PRECIO, las dos funciones puras con
 * las que el servidor decide. Aparte de `catalog-import-plan.test.ts` por el hook
 * `file-size`.
 */
describe("la clave canónica (§2)", () => {
  it("ignora acentos, mayúsculas y puntuación, y colapsa espacios", () => {
    expect(matchKey("Coca-Cola")).toBe(matchKey("coca cola"));
    expect(matchKey("  Café   con   Leche ")).toBe("cafe con leche");
    expect(matchKey("Té de hierbas")).toBe("te de hierbas");
  });

  /** **No es fuzzy**: lo que se parece pero no es igual, no es igual. */
  it("NO es fuzzy: «Hamburguesa» ≠ «Hamburguesa doble»", () => {
    expect(matchKey("Hamburguesa")).not.toBe(matchKey("Hamburguesa doble"));
    expect(matchKey("Agua")).not.toBe(matchKey("Aguas"));
  });
});

/**
 * §4 — EL PRECIO LO DECIDE EL SERVIDOR.
 *
 * ORACULO DE M4: los casos que **no** parsean aseveran `null` con `toBeNull()`, que un `0`
 * o un `"0.00"` no satisfacen. Un parser que devolviera cero ante la duda pone en rojo cada
 * fila de la segunda tabla.
 */
describe("el parseo del precio impreso (§4)", () => {
  it.each([
    ["3.25", "3.25"],
    ["$3,25", "3.25"],
    ["$ 3,25 c/u", "3.25"],
    ["12", "12.00"],
    ["1.250,00", "1250.00"],
    ["1,250.00", "1250.00"],
    ["1.500", "1500.00"],
    ["1.234.567,89", "1234567.89"],
  ])("«%s» parsea a %s", (texto, esperado) => {
    expect(parsePriceText(texto)).toBe(esperado);
  });

  it.each([
    ["3-5", "un rango"],
    ["-3.00", "un signo"],
    ["+3.00", "un signo"],
    ["s/d", "cero dígitos"],
    ["", "vacío"],
    ["consultar", "cero dígitos"],
    ["1.23.45", "más de un candidato a decimal"],
    ["1,23.45", "más de un candidato a decimal"],
    ["1.5", "un separador que no es ni decimal ni de miles"],
    ["1.2345", "un separador de miles con 4 dígitos"],
    ["3,25 / 5,00", "dos precios"],
    ["3.", "un separador colgado"],
    [".50", "un separador colgado"],
  ])("«%s» NO parsea (%s) y queda en null, nunca en 0", (texto) => {
    expect(parsePriceText(texto)).toBeNull();
  });

  it("un `priceText` ausente es null y no rompe", () => {
    expect(parsePriceText(null)).toBeNull();
    expect(parsePriceText(undefined)).toBeNull();
  });
});
