import { describe, expect, it } from "vitest";
import { LoyaltyError } from "../loyalty-program/core";
import { validateProgramInput } from "../loyalty-program/validation";
import {
  WIZARD_UNIT_NAME,
  WIZARD_UNIT_PLURAL,
  composeWizardProgramInput,
  resolveWizardClauseIds,
  validateWizardRequest,
} from "./program-defaults";

/**
 * Spec 0069 §D4 — dos campos adentro, un `ProgramInput` COMPLETO afuera.
 *
 * El oraculo mas fuerte de este archivo no es contar claves: es pasarle lo compuesto a
 * **`validateProgramInput`, el validador real de `saveProgram`**. Si la composicion se
 * olvidara de las clausulas, del `unitName` o del premio, ese validador tira 422 y el
 * test se pone rojo por la propiedad correcta, no por una forma que inventamos aca.
 */
const TEMPLATE_IDS = [
  "9d4a3a05-2a87-4d12-8a99-e1a59e3cf101",
  "9d4a3a05-2a87-4d12-8a99-e1a59e3cf102",
];

const statusOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof LoyaltyError ? error.status : "no-LoyaltyError";
  }
  return "no tiró";
};

describe("validateWizardRequest (spec 0069 §D4)", () => {
  it("acepta el objetivo en los dos bordes y recorta el nombre del premio", () => {
    expect(
      validateWizardRequest({
        target: 2,
        reward: { type: "custom", label: "  Café gratis  " },
      }),
    ).toEqual({ target: 2, label: "Café gratis" });
    expect(
      validateWizardRequest({
        target: 50,
        reward: { type: "custom", label: "Café gratis" },
      }),
    ).toEqual({ target: 50, label: "Café gratis" });
  });

  it.each([[1], [51], [0], [-3], [2.5], ["8"], [null], [undefined]])(
    "rechaza el objetivo %j con 422",
    (target) => {
      expect(
        statusOf(() =>
          validateWizardRequest({
            target,
            reward: { type: "custom", label: "Café" },
          }),
        ),
      ).toBe(422);
    },
  );

  it.each([
    { caso: "sin premio", reward: undefined as unknown },
    { caso: "premio sin nombre", reward: { type: "custom" } },
    { caso: "nombre en blanco", reward: { type: "custom", label: "   " } },
    {
      caso: "tipo que el wizard no ofrece",
      reward: { type: "discount", discountPercent: 10 },
    },
    {
      caso: "tipo del catálogo",
      reward: { type: "catalog_product", productId: "x" },
    },
  ])("rechaza el premio: $caso → 422", ({ reward }) => {
    expect(statusOf(() => validateWizardRequest({ target: 8, reward }))).toBe(
      422,
    );
  });

  it("rechaza un cuerpo que no es objeto", () => {
    expect(statusOf(() => validateWizardRequest(null))).toBe(422);
    expect(statusOf(() => validateWizardRequest([]))).toBe(422);
    expect(statusOf(() => validateWizardRequest("target=8"))).toBe(422);
  });
});

describe("composeWizardProgramInput (spec 0069 §D4)", () => {
  const composed = composeWizardProgramInput(8, "Café gratis", TEMPLATE_IDS);

  it("compone DOS cláusulas, UN premio y el unitName del wizard", () => {
    expect(composed.clauses).toEqual([
      { templateId: TEMPLATE_IDS[0] },
      { templateId: TEMPLATE_IDS[1] },
    ]);
    expect(composed.rewards).toEqual([
      { type: "custom", label: "Café gratis" },
    ]);
    expect(composed.configuration).toEqual({
      unitName: WIZARD_UNIT_NAME,
      unitPlural: WIZARD_UNIT_PLURAL,
      target: 8,
    });
    expect(composed.kind).toBe("stamps");
    // El wizard no sube imagen: de acá sale el placeholder de §D5.
    expect(composed.stampAction).toBe("keep");
  });

  it("lo compuesto PASA el validador real de saveProgram", () => {
    const validated = validateProgramInput(composed);
    expect(validated.kind).toBe("stamps");
    expect(validated.clauses).toHaveLength(2);
    expect(validated.rewards).toHaveLength(1);
    expect(validated.rewards[0].label).toBe("Café gratis");
    expect(validated.rewards[0].pointsCost).toBeNull();
    // El plural SOBREVIVE a `normalizeConfiguration`: si se cayera ahi, el TOS
    // volveria a decir «Los sello» sin que nada mas se ponga rojo (spec 0078).
    expect(validated.configuration).toEqual({
      unitName: WIZARD_UNIT_NAME,
      unitPlural: WIZARD_UNIT_PLURAL,
      target: 8,
    });
    expect(validated.accrual).toEqual({
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
  });

  it("sin cláusulas, el validador real lo RECHAZA (por eso las semillas son obligatorias)", () => {
    expect(
      statusOf(() =>
        validateProgramInput(composeWizardProgramInput(8, "Café", [])),
      ),
    ).toBe(422);
  });
});

/**
 * El 503 sin base: `resolveWizardClauseIds` es la traduccion `null` → `LoyaltyError`, y
 * es lo que garantiza que NUNCA se componga un programa sin terminos.
 *
 * **Por que este caso NO tiene gemelo contra Neon:** `termsScopeCandidates` siempre
 * appendea `"default"` al final, asi que con las semillas puestas el 503 es inalcanzable
 * **por construccion** para cualquier pais. El contrato de la RUTA para ese 503 —el
 * `code` y que `saveProgram` no se llame— lo pinnea `onboarding-program-503.test.ts` con
 * dobles. Lo unico declarado afuera es «una base real sin semillas».
 */
describe("resolveWizardClauseIds (spec 0078 §3)", () => {
  const rows = [
    { id: "ec-1", key: "earning", jurisdictionScope: "EC" },
    { id: "ec-2", key: "redemption", jurisdictionScope: "EC" },
    { id: "def-1", key: "earning", jurisdictionScope: "default" },
    { id: "def-2", key: "redemption", jurisdictionScope: "default" },
  ];

  it("devuelve las dos del primer candidato COMPLETO", () => {
    expect(resolveWizardClauseIds(rows, ["EC", "default"])).toEqual([
      "ec-1",
      "ec-2",
    ]);
    expect(resolveWizardClauseIds(rows, ["MX", "default"])).toEqual([
      "def-1",
      "def-2",
    ]);
  });

  it("con el candidato del pais a medias, NO mezcla: las dos de `default`", () => {
    expect(
      resolveWizardClauseIds(
        rows.filter((row) => row.id !== "ec-2"),
        ["EC", "default"],
      ),
    ).toEqual(["def-1", "def-2"]);
  });

  it("sin ningun candidato completo tira 503, no compone nada", () => {
    expect(statusOf(() => resolveWizardClauseIds([], ["EC", "default"]))).toBe(
      503,
    );
    expect(
      statusOf(() =>
        resolveWizardClauseIds(
          rows.filter((row) => row.key === "earning"),
          ["EC", "default"],
        ),
      ),
    ).toBe(503);
  });
});
