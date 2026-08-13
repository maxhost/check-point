import { LoyaltyError, type LoyaltyKind, type ProgramInput } from "./core";

type SupportedKind = "points" | "stamps";
const enabledKinds = new Set<SupportedKind>(["points", "stamps"]);

const isLoyaltyKind = (value: unknown): value is LoyaltyKind =>
  value === "points" ||
  value === "stamps" ||
  value === "tiers" ||
  value === "cashback";

const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

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
  const normalized: Record<string, unknown> = {
    unitName: String(configuration.unitName).trim(),
    target: Number(configuration.target),
  };
  const stampImageObjectKey = nonEmpty(configuration.stampImageObjectKey);
  if (stampImageObjectKey) normalized.stampImageObjectKey = stampImageObjectKey;
  return normalized;
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
      Number(configuration.target) > 50 ||
      (configuration.stampImageObjectKey !== undefined &&
        !nonEmpty(configuration.stampImageObjectKey))
    ) {
      throw new LoyaltyError(
        422,
        "Los sellos requieren nombre y un objetivo entero entre 2 y 50.",
      );
    }
  }
  return {
    kind: input.kind,
    configuration: normalizeConfiguration(input.kind, configuration),
    clauses,
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
