import type { LoyaltyProgramDemo } from "./demo";

const trim = (value: string) => value.trim();

export function validateLoyaltyProgram(
  program: LoyaltyProgramDemo,
  type: Exclude<LoyaltyProgramDemo["type"], null>,
) {
  if (type === "points") {
    if (!trim(program.pointUnitSingular) || !trim(program.pointUnitPlural)) {
      return "Indica el nombre singular y plural de tus puntos.";
    }
    return null;
  }

  if (!trim(program.stampUnitName)) {
    return "Indica el nombre de tu sello.";
  }
  if (
    !Number.isInteger(program.stampTarget) ||
    program.stampTarget < 2 ||
    program.stampTarget > 50
  ) {
    return "La tarjeta debe requerir entre 2 y 50 sellos.";
  }
  return null;
}

export function normalizedLoyaltyProgram(
  program: LoyaltyProgramDemo,
): LoyaltyProgramDemo {
  return {
    ...program,
    pointUnitSingular: trim(program.pointUnitSingular),
    pointUnitPlural: trim(program.pointUnitPlural),
    stampUnitName: trim(program.stampUnitName),
  };
}
