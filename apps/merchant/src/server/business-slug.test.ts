import { describe, expect, it } from "vitest";
import { SlugError, isUniqueViolation, parseSlug } from "./business-slug";
import { RESERVED_SLUGS } from "./slug";

/**
 * Spec 0067 §1 — la parte SIN BASE del cambio explícito de slug. Lo que sí necesita Neon
 * —que renombrar el negocio no lo mueva, y que el duplicado salga del choque del único—
 * vive en `business-slug.neon.integration.test.ts`.
 */
const codeOf = (value: unknown) => {
  try {
    parseSlug(value);
    return "<sin error>";
  } catch (error) {
    return error instanceof SlugError ? error.code : "<otro error>";
  }
};

describe("parseSlug (spec 0067 §1)", () => {
  it("acepta la forma normativa y normaliza a minúsculas", () => {
    expect(parseSlug("la-farmacia")).toBe("la-farmacia");
    expect(parseSlug("  La-Farmacia  ")).toBe("la-farmacia");
    expect(parseSlug("abc")).toBe("abc");
    expect(parseSlug("a".repeat(30))).toBe("a".repeat(30));
  });

  it.each([
    ["-empieza-con-guion", "invalid_slug"],
    ["termina-con-guion-", "invalid_slug"],
    ["ab", "invalid_slug"],
    ["a".repeat(31), "invalid_slug"],
    ["con_guion_bajo", "invalid_slug"],
    ["con espacio", "invalid_slug"],
    ["acentuación", "invalid_slug"],
    ["", "invalid_slug"],
    [null, "invalid_slug"],
    [42, "invalid_slug"],
  ])("rechaza %s con %s", (value, code) => {
    expect(codeOf(value)).toBe(code);
  });

  // Lo que `slugify` NO mira a propósito (es pura y no conoce la lista): acá es donde una
  // reservada tiene que morir. Se recorren TODAS, no una de muestra.
  it("rechaza todas las palabras reservadas que pasan la forma", () => {
    const reachable = RESERVED_SLUGS.filter(
      (slug) => codeOf(slug) !== "invalid_slug",
    );
    // Piso: si la lista se vaciara o la forma se aflojara, este test no puede quedar verde
    // sin haber probado nada.
    expect(reachable.length).toBeGreaterThanOrEqual(10);
    for (const slug of reachable) expect(codeOf(slug)).toBe("reserved_slug");
  });

  it("`Admin` —lo que devuelve slugify— es rechazado, no aceptado", () => {
    expect(codeOf("Admin")).toBe("reserved_slug");
  });
});

describe("isUniqueViolation", () => {
  it("reconoce el 23505 propio y el anidado en `cause`", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ cause: { cause: { code: "23505" } } })).toBe(
      true,
    );
    expect(isUniqueViolation({ code: "23514" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});
