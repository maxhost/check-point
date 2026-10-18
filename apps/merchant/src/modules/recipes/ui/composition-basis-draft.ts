import {
  captureQuantity,
  CONVERSION_VERSION,
  type MeasureUnit,
} from "@mi-pasaporte/domain/measures";
import type { CompositionBasisDTO } from "../server/contracts";

export type BasisDraft = {
  basisQuantity: string;
  basisUnit: MeasureUnit;
  conversionVersion: typeof CONVERSION_VERSION;
};
export const defaultBasis = (): BasisDraft => ({
  basisQuantity: "1",
  basisUnit: "unit",
  conversionVersion: CONVERSION_VERSION,
});
export function validBasis(draft: BasisDraft): BasisDraft {
  try {
    if (draft.conversionVersion !== CONVERSION_VERSION) throw new Error();
    const capture = captureQuantity(
      draft.basisQuantity.trim().replace(",", "."),
      draft.basisUnit,
    );
    return {
      basisQuantity: capture.quantity,
      basisUnit: capture.quantityUnit,
      conversionVersion: CONVERSION_VERSION,
    };
  } catch {
    throw new Error(
      "Completa una base mayor que cero, hasta 999999999,999999999 y 9 decimales. Las unidades deben ser enteras.",
    );
  }
}
export function readBasis(dto: CompositionBasisDTO): BasisDraft {
  if (
    dto.basisQuantity === undefined &&
    dto.basisUnit === undefined &&
    dto.conversionVersion === undefined
  )
    return defaultBasis();
  if (
    typeof dto.basisQuantity !== "string" ||
    !dto.basisUnit ||
    !dto.conversionVersion
  )
    throw new Error(
      "No pudimos verificar la base guardada. Consulta de nuevo antes de guardar.",
    );
  return validBasis({
    basisQuantity: dto.basisQuantity,
    basisUnit: dto.basisUnit,
    conversionVersion: dto.conversionVersion,
  });
}
export const unitLabel = (unit: MeasureUnit) =>
  ({ unit: "unidad", kg: "kg", lb: "lb", g: "g" })[unit];
export function basisLabel(dto: CompositionBasisDTO) {
  try {
    const basis = readBasis(dto);
    return `${basis.basisQuantity.replace(".", ",")} ${basis.basisUnit === "unit" ? (basis.basisQuantity === "1" ? "unidad" : "unidades") : basis.basisUnit}`;
  } catch {
    return "Base sin verificar";
  }
}
