import { describe, expect, it } from "vitest";
import {
  DEFAULT_TERMS_SCOPE,
  type ScopedTemplate,
  scopedTemplateIds,
  termsScopeCandidates,
} from "./terms-scope";

/**
 * Spec 0078 — la eleccion del TOS es PURA, asi que su oraculo es una tabla de casos.
 *
 * Lo que este archivo pinnea es la propiedad que el owner pidio (el TOS sale del pais
 * del negocio) y su invariante duro: **no se mezcla**. Lo que NO pinnea —y lo pinnea la
 * integracion Neon— es que la consulta traiga las filas correctas.
 */
describe("termsScopeCandidates", () => {
  it.each([
    ["EC", ["EC", "default"]],
    ["ec", ["EC", "default"]],
    [" ec ", ["EC", "default"]],
    ["MX", ["MX", "default"]],
  ])("%j → %j", (input, expected) => {
    expect(termsScopeCandidates(input)).toEqual(expected);
  });

  it.each([[null], [undefined], [""], ["  "], ["ECU"], ["E"], ["E1"], ["12"]])(
    "%j cae directo a `default`",
    (input) => {
      expect(termsScopeCandidates(input as string | null | undefined)).toEqual([
        DEFAULT_TERMS_SCOPE,
      ]);
    },
  );

  it("el scope de caida es SIEMPRE el ultimo candidato", () => {
    for (const input of ["EC", "mx", null, "ECU"]) {
      const candidates = termsScopeCandidates(input);
      expect(candidates.at(-1)).toBe(DEFAULT_TERMS_SCOPE);
      expect(candidates.filter((s) => s === DEFAULT_TERMS_SCOPE)).toHaveLength(
        1,
      );
    }
  });
});

const row = (
  jurisdictionScope: string,
  key: string,
  id: string,
): ScopedTemplate => ({ id, key, jurisdictionScope });

const KEYS = ["earning", "redemption"] as const;

describe("scopedTemplateIds", () => {
  const ec = [row("EC", "earning", "ec-1"), row("EC", "redemption", "ec-2")];
  const fallback = [
    row("default", "earning", "def-1"),
    row("default", "redemption", "def-2"),
  ];

  it("con el scope del pais COMPLETO, sale el del pais", () => {
    expect(
      scopedTemplateIds([...fallback, ...ec], ["EC", "default"], KEYS),
    ).toEqual(["ec-1", "ec-2"]);
  });

  it("sin scope del pais, cae a `default`", () => {
    expect(scopedTemplateIds(fallback, ["MX", "default"], KEYS)).toEqual([
      "def-1",
      "def-2",
    ]);
  });

  /** El invariante de la spec: media clausula de cada scope no es un TOS. */
  it("con el scope del pais INCOMPLETO, salen las DOS de `default` (no se mezcla)", () => {
    const parcial = [row("EC", "earning", "ec-1"), ...fallback];
    expect(scopedTemplateIds(parcial, ["EC", "default"], KEYS)).toEqual([
      "def-1",
      "def-2",
    ]);
  });

  it("el orden es el de `keys`, no el de las filas", () => {
    expect(
      scopedTemplateIds([...ec].reverse(), ["EC", "default"], KEYS),
    ).toEqual(["ec-1", "ec-2"]);
    expect(scopedTemplateIds(ec, ["EC"], ["redemption", "earning"])).toEqual([
      "ec-2",
      "ec-1",
    ]);
  });

  it("si NINGUN candidato esta completo, devuelve null", () => {
    expect(
      scopedTemplateIds(
        [row("EC", "earning", "ec-1"), row("default", "earning", "def-1")],
        ["EC", "default"],
        KEYS,
      ),
    ).toBeNull();
    expect(scopedTemplateIds([], ["EC", "default"], KEYS)).toBeNull();
  });

  it("una fila de OTRO scope no cuenta para completar un candidato", () => {
    expect(
      scopedTemplateIds(
        [
          row("EC", "earning", "ec-1"),
          row("global-draft", "redemption", "g-2"),
        ],
        ["EC", "default"],
        KEYS,
      ),
    ).toBeNull();
  });
});
