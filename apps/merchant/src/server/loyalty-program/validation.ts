import {
  type CardDesignInput,
  LoyaltyError,
  type LoyaltyKind,
  type ProgramInput,
  type StampAction,
} from "./core";
import { validateAccrual } from "./accrual";
import { validateRewardsInput } from "./rewards";

type SupportedKind = "points" | "stamps";
const enabledKinds = new Set<SupportedKind>(["points", "stamps"]);

const isLoyaltyKind = (value: unknown): value is LoyaltyKind =>
  value === "points" ||
  value === "stamps" ||
  value === "tiers" ||
  value === "cashback";

const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const normHex = (value: unknown) =>
  typeof value === "string" && HEX_COLOR.test(value.trim())
    ? value.trim().toUpperCase()
    : null;

/**
 * Validates the optional card design. Points must not carry a design (`422`); Sellos
 * may omit it (returns null — the DTO shows null colors and the UI falls back to brand).
 * A second background requires a valid first color and an integer angle 0..360
 * (defaults to 180 when omitted); without a second color the angle is dropped.
 */
export function validateCardDesign(
  kind: LoyaltyKind,
  raw: unknown,
): CardDesignInput | null {
  const provided = raw !== undefined && raw !== null;
  if (kind !== "stamps") {
    if (provided)
      throw new LoyaltyError(422, "Solo los Sellos tienen diseño de tarjeta.");
    return null;
  }
  if (!provided) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new LoyaltyError(422, "El diseño de la tarjeta no es válido.");
  }
  const design = raw as Record<string, unknown>;
  const backgroundColor = normHex(design.backgroundColor);
  if (!backgroundColor)
    throw new LoyaltyError(422, "El color de fondo debe ser #RRGGBB.");
  const borderColor = normHex(design.borderColor);
  if (!borderColor)
    throw new LoyaltyError(422, "El color de borde debe ser #RRGGBB.");
  let backgroundColor2: string | null = null;
  let gradientAngle: number | null = null;
  if (
    design.backgroundColor2 !== undefined &&
    design.backgroundColor2 !== null
  ) {
    backgroundColor2 = normHex(design.backgroundColor2);
    if (!backgroundColor2)
      throw new LoyaltyError(
        422,
        "El segundo color de fondo debe ser #RRGGBB.",
      );
    const rawAngle = design.gradientAngle;
    if (rawAngle === undefined || rawAngle === null) {
      gradientAngle = 180;
    } else if (
      !Number.isInteger(rawAngle) ||
      (rawAngle as number) < 0 ||
      (rawAngle as number) > 360
    ) {
      throw new LoyaltyError(
        422,
        "El ángulo del degradé debe ser un entero entre 0 y 360.",
      );
    } else {
      gradientAngle = rawAngle as number;
    }
  }
  return { backgroundColor, backgroundColor2, gradientAngle, borderColor };
}

/** Keeps only the fields that belong to a modality, so clients cannot persist arbitrary jsonb. */
export function normalizeConfiguration(
  kind: LoyaltyKind,
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  if (kind === "points") {
    return {
      unitSingular: String(configuration.unitSingular).trim(),
      unitPlural: String(configuration.unitPlural).trim(),
    };
  }
  // The stamp image lives in dedicated columns (spec 0026), never in configuration jsonb.
  return {
    unitName: String(configuration.unitName).trim(),
    target: Number(configuration.target),
  };
}

export function validateProgramInput(value: unknown): ProgramInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LoyaltyError(422, "El programa debe ser un objeto válido.");
  }
  const input = value as Record<string, unknown>;
  if (
    !isLoyaltyKind(input.kind) ||
    !enabledKinds.has(input.kind as SupportedKind)
  ) {
    throw new LoyaltyError(422, "Esta modalidad todavía no está disponible.");
  }
  if (
    !input.configuration ||
    typeof input.configuration !== "object" ||
    Array.isArray(input.configuration)
  ) {
    throw new LoyaltyError(422, "La configuración no es válida.");
  }
  if (!Array.isArray(input.clauses) || input.clauses.length > 12) {
    throw new LoyaltyError(
      422,
      "Las cláusulas deben ser una lista de hasta 12 textos.",
    );
  }
  const clauses = input.clauses.map((clause) => {
    if (!clause || typeof clause !== "object" || Array.isArray(clause)) {
      throw new LoyaltyError(422, "Cada cláusula debe ser válida.");
    }
    const item = clause as Record<string, unknown>;
    const templateId = nonEmpty(item.templateId);
    const text = nonEmpty(item.text);
    if (!templateId && !text) {
      throw new LoyaltyError(
        422,
        "Cada cláusula debe tener texto o plantilla.",
      );
    }
    return { templateId: templateId ?? undefined, text: text ?? undefined };
  });
  if (!clauses.length) {
    throw new LoyaltyError(422, "Añade al menos una cláusula de términos.");
  }
  const configuration = input.configuration as Record<string, unknown>;
  if (input.kind === "points") {
    if (
      !nonEmpty(configuration.unitSingular) ||
      !nonEmpty(configuration.unitPlural)
    ) {
      throw new LoyaltyError(
        422,
        "Completa el nombre singular y plural de la unidad.",
      );
    }
  }
  if (input.kind === "stamps") {
    if (
      !nonEmpty(configuration.unitName) ||
      !Number.isInteger(configuration.target) ||
      Number(configuration.target) < 2 ||
      Number(configuration.target) > 50
    ) {
      throw new LoyaltyError(
        422,
        "Los sellos requieren nombre y un objetivo entero entre 2 y 50.",
      );
    }
  }
  const stampAction = (input.stampAction ?? "keep") as StampAction;
  if (
    stampAction !== "keep" &&
    stampAction !== "replace" &&
    stampAction !== "remove"
  ) {
    throw new LoyaltyError(422, "La acción del sello no es válida.");
  }
  if (input.kind !== "stamps" && stampAction !== "keep") {
    throw new LoyaltyError(422, "Solo los Sellos aceptan una imagen de sello.");
  }
  const stampUploadId = nonEmpty(input.stampUploadId) ?? undefined;
  if (stampAction === "replace" && !stampUploadId) {
    throw new LoyaltyError(
      422,
      "Selecciona una imagen de sello antes de guardar.",
    );
  }
  if (stampAction !== "replace" && stampUploadId) {
    throw new LoyaltyError(
      422,
      "La carga de sello no corresponde a esta acción.",
    );
  }
  // `stampCropped` marks a blob produced by the 1:1 client cropper so the server can decode
  // it under the strict pixel bound; only meaningful with `replace`, like `stampUploadId`.
  const stampCropped = input.stampCropped;
  if (stampCropped !== undefined && typeof stampCropped !== "boolean") {
    throw new LoyaltyError(422, "La marca de recorte no es válida.");
  }
  if (stampAction !== "replace" && stampCropped !== undefined) {
    throw new LoyaltyError(
      422,
      "La marca de recorte no corresponde a esta acción.",
    );
  }
  const cardDesign = validateCardDesign(input.kind, input.cardDesign);
  const accrual = validateAccrual(input.kind, input.accrual);
  // Form-only: catalog_product ownership + label snapshot resolve in saveProgram (needs DB).
  const rewards = validateRewardsInput(input.kind, input.rewards);
  return {
    kind: input.kind,
    configuration: normalizeConfiguration(input.kind, configuration),
    clauses,
    stampAction,
    stampUploadId,
    stampCropped: stampCropped === true,
    cardDesign,
    accrual,
    rewards,
  };
}

export function renderTermsText(
  text: string,
  variables: Record<string, string>,
  allowedVariables: readonly string[],
) {
  return text.replace(/{{([a-z_]+)}}/g, (_, key: string) => {
    if (!allowedVariables.includes(key) || !variables[key]) {
      throw new LoyaltyError(422, `La variable {{${key}}} no está permitida.`);
    }
    return variables[key];
  });
}
