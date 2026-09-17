import { describe, expect, it } from "vitest";
import { BUSINESS_CATEGORIES, isBusinessCategory } from "./business-categories";

/**
 * Spec 0069 §D1 — la lista curada de categorias `gcid:`.
 *
 * El conteo se asevera ACA y **no** con un `rg 'gcid:'` sobre el archivo: ese barrido
 * cuenta tambien las menciones de los comentarios y el default `gcid:store`, asi que no
 * puede dar el numero exacto. Es la misma clase de criterio mal formado que la spec 0067
 * cerro cuatro veces (`docs/LECCIONES.md`).
 */
describe("BUSINESS_CATEGORIES (spec 0069 §D1)", () => {
  it("tiene exactamente las 15 entradas que confirmó el owner", () => {
    expect(BUSINESS_CATEGORIES.length).toBe(15);
    expect(BUSINESS_CATEGORIES.map((category) => category.gcid)).toEqual([
      "gcid:restaurant",
      "gcid:cafe",
      "gcid:bakery",
      "gcid:bar",
      "gcid:pizza_restaurant",
      "gcid:ice_cream_shop",
      "gcid:beauty_salon",
      "gcid:barber_shop",
      "gcid:nail_salon",
      "gcid:gym",
      "gcid:pharmacy",
      "gcid:grocery_store",
      "gcid:clothing_store",
      "gcid:pet_store",
      "gcid:car_wash",
    ]);
  });

  it("cada entrada tiene un displayName en español, no vacío", () => {
    for (const category of BUSINESS_CATEGORIES) {
      expect(typeof category.displayName).toBe("string");
      expect(category.displayName.trim().length).toBeGreaterThan(0);
    }
  });

  it("acepta cada gcid de la lista", () => {
    for (const category of BUSINESS_CATEGORIES) {
      expect(isBusinessCategory(category.gcid)).toBe(true);
    }
  });

  it.each([
    ["gcid:inventado", "un gcid que no está en la lista"],
    ["restaurant", "el mismo valor SIN el prefijo gcid:"],
    [
      "gcid:store",
      "el DEFAULT de la columna: es relleno de migración, no categoría",
    ],
    ["GCID:CAFE", "otra caja"],
    [" gcid:cafe", "con espacio delante: no se normaliza a propósito"],
    ["", "vacío"],
  ])("rechaza %j (%s)", (value) => {
    expect(isBusinessCategory(value)).toBe(false);
  });

  it.each([
    [null],
    [undefined],
    [42],
    [{ gcid: "gcid:cafe" }],
    [["gcid:cafe"]],
  ])("rechaza el no-string %j", (value) => {
    expect(isBusinessCategory(value)).toBe(false);
  });
});
