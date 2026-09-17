import { describe, expect, it } from "vitest";
import { isValidSlug, nextSuggestion, RESERVED_SLUGS, slugify } from "./slug";

/**
 * Spec 0067 §1 y su «Plan de pruebas»: unitarias PURAS, sin Neon.
 *
 * Las tres propiedades portantes, en orden de importancia:
 *  1. `slugify` nunca produce algo que `isValidSlug` rechace — el wizard no expone campo
 *     de slug, asi que no hay quien corrija la forma.
 *  2. `RESERVED_SLUGS` no se puede vaciar en silencio: el piso de abajo se pone rojo si
 *     alguien borra una entrada.
 *  3. La forma es la de la spec, no «lo que salga»: los rechazos estan aseverados uno por
 *     uno (guion al borde, mayusculas, `_`, largo 2 y 31).
 */

describe("slugify", () => {
  it("deriva el slug del nombre CONSERVANDO el separador", () => {
    // Decidido en la spec §1: `la-farmacia`, no `lafarmacia`. Quitar separadores
    // colapsaria `el-arbol` y `elarbol` en el mismo handle.
    expect(slugify("La Farmacia")).toBe("la-farmacia");
  });

  it("descarta diacriticos por normalizacion NFD", () => {
    expect(slugify("Café Olé")).toBe("cafe-ole");
    expect(slugify("Ñandú Piñón")).toBe("nandu-pinon");
  });

  it("convierte los simbolos en guiones y los colapsa", () => {
    expect(slugify("¡Pizza & Pasta!!! (Centro)")).toBe("pizza-pasta-centro");
    expect(slugify("--Hola--Mundo--")).toBe("hola-mundo");
    expect(slugify("A  B")).toBe("a-b");
  });

  it("rellena un nombre de 1 caracter hasta el minimo de 3", () => {
    expect(slugify("A")).toBe("a00");
    expect(slugify("Á")).toBe("a00");
  });

  it("recorta a 30 sin dejar un guion colgando en el borde", () => {
    const sixty = "Panaderia de la Esquina del Barrio Norte de la Ciudad";
    const cut = slugify(sixty);
    expect(cut.length).toBeLessThanOrEqual(30);
    expect(cut).toBe("panaderia-de-la-esquina-del-ba");

    // El corte a 30 cae JUSTO sobre un guion: si no se volviera a recortar, el
    // resultado terminaria en `-` y seria invalido.
    expect(slugify("Panaderia de la Esquina dela X")).toBe(
      "panaderia-de-la-esquina-dela-x",
    );
    expect(slugify("Panaderia de la Esquina delax X")).toBe(
      "panaderia-de-la-esquina-delax",
    );
  });

  it("SIEMPRE produce una forma que isValidSlug acepta", () => {
    const names = [
      "A",
      "Á",
      "!!!",
      "   ",
      "-",
      "42",
      "La Farmacia",
      "Café Olé",
      "¡Pizza & Pasta!!! (Centro)",
      "Panaderia de la Esquina del Barrio Norte de la Ciudad",
      "x".repeat(60),
      "日本語",
      "Bar_El_Tio",
    ];
    for (const name of names) {
      expect([name, isValidSlug(slugify(name))]).toEqual([name, true]);
    }
  });
});

describe("isValidSlug", () => {
  it("acepta la forma de la spec", () => {
    for (const ok of ["abc", "la-farmacia", "a-b", "x".repeat(30), "123"]) {
      expect([ok, isValidSlug(ok)]).toEqual([ok, true]);
    }
  });

  it("rechaza guion inicial y final", () => {
    expect(isValidSlug("-farmacia")).toBe(false);
    expect(isValidSlug("farmacia-")).toBe(false);
  });

  it("rechaza mayusculas y guion bajo", () => {
    expect(isValidSlug("La-Farmacia")).toBe(false);
    expect(isValidSlug("la_farmacia")).toBe(false);
  });

  it("rechaza largo 2 y largo 31", () => {
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("x".repeat(30))).toBe(true);
    expect(isValidSlug("x".repeat(31))).toBe(false);
  });
});

describe("RESERVED_SLUGS", () => {
  /**
   * PISO aseverado, no `length` a secas: borrar una entrada tiene que poner esto rojo
   * nombrando cual falta. Es la mutacion plausible «vaciar la lista y que nadie se
   * entere» — con `expect(RESERVED_SLUGS.length).toBeGreaterThan(0)` pasaria.
   */
  const FLOOR = [
    // Segmentos de ruta que existen HOY.
    "api",
    "backoffice",
    "login",
    "onboarding",
    "forgot-password",
    "c",
    "enroll",
    "recover",
    "wallet",
    "_next",
    "es",
    "en",
    // Genericos que el owner no puede quedarse (spec §1).
    "admin",
    "app",
    "www",
    "static",
    "public",
    "health",
  ];

  it("contiene el piso completo de la spec §1", () => {
    const missing = FLOOR.filter((slug) => !RESERVED_SLUGS.includes(slug));
    expect(missing).toEqual([]);
    expect(RESERVED_SLUGS.length).toBeGreaterThanOrEqual(FLOOR.length);
  });

  it("no tiene duplicados", () => {
    expect(new Set(RESERVED_SLUGS).size).toBe(RESERVED_SLUGS.length);
  });
});

describe("nextSuggestion", () => {
  it("devuelve la raiz cuando esta libre", () => {
    expect(nextSuggestion("la-farmacia", [])).toBe("la-farmacia");
  });

  it("sufija con el primer numero libre ante colision", () => {
    expect(nextSuggestion("la-farmacia", ["la-farmacia"])).toBe(
      "la-farmacia-2",
    );
    expect(
      nextSuggestion("la-farmacia", [
        "la-farmacia",
        "la-farmacia-2",
        "la-farmacia-3",
      ]),
    ).toBe("la-farmacia-4");
  });

  it("nunca sugiere una reservada", () => {
    expect(nextSuggestion("login", [])).toBe("login-2");
  });

  it("normaliza una raiz que no es un slug valido", () => {
    expect(nextSuggestion("La Farmacia", ["la-farmacia"])).toBe(
      "la-farmacia-2",
    );
  });

  it("recorta la RAIZ, no el sufijo, para no pasarse de 30", () => {
    const root = "x".repeat(30);
    const suggestion = nextSuggestion(root, [root]);
    expect(suggestion).toBe(`${"x".repeat(28)}-2`);
    expect(suggestion.length).toBe(30);
    expect(isValidSlug(suggestion)).toBe(true);
  });
});
