import {
  CounterError,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  captureQuantity,
  isMassUnit,
  MeasureError,
  parseMeasure,
  trustedUnitSnapshotQuantity,
} from "@mi-pasaporte/domain/measures";
import type { PosExistingLineV2, PosLineV2, PosNewLineV2 } from "../contracts";

export function invalidPosInput(): never {
  throw new CounterError(
    422,
    "invalid_input",
    "El comando de la orden no es válido.",
  );
}
export function inputObject(
  raw: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalidPosInput();
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    invalidPosInput();
  return value;
}
export function inputUuid(raw: unknown, field: string): string {
  return parseUuid(raw, field).toLowerCase();
}
/** Translate measure failures to the existing HTTP error family without exposing input. */
function measured<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof MeasureError)
      throw new CounterError(
        422,
        error.code,
        "La cantidad o la unidad no es válida.",
      );
    throw error;
  }
}
export function parseMeasuredLineInput(
  raw: unknown,
  allowExisting = false,
): PosNewLineV2 | PosExistingLineV2 {
  const value = inputObject(raw, [
    "lineId",
    "productId",
    "quantity",
    "quantityUnit",
    "catalogRevision",
  ]);
  const existing = Object.hasOwn(value, "lineId");
  if (existing && !allowExisting) invalidPosInput();
  const quantityUnit = value.quantityUnit;
  if (quantityUnit !== "unit" && !isMassUnit(quantityUnit))
    throw new CounterError(422, "invalid_unit", "La unidad no es válida.");
  if (existing) {
    if (Object.hasOwn(value, "catalogRevision")) invalidPosInput();
    // Syntax only: a large unit count is NOT accepted until matched to a trusted row.
    // Do not run the trusted snapshot adapter on HTTP data.
    let quantity: string;
    if (
      quantityUnit === "unit" &&
      typeof value.quantity === "string" &&
      /^\d{1,10}(?:\.0{1,9})?$/.test(value.quantity)
    ) {
      const count = BigInt(value.quantity.split(".")[0]);
      if (count < 1n || count > 2147483647n)
        throw new CounterError(
          422,
          "invalid_quantity",
          "La cantidad no es válida.",
        );
      quantity = String(count);
    } else {
      quantity = measured(() =>
        captureQuantity(value.quantity, quantityUnit),
      ).quantity;
    }
    return {
      lineId: inputUuid(value.lineId, "lineId"),
      productId:
        value.productId === null
          ? null
          : inputUuid(value.productId, "productId"),
      quantity,
      quantityUnit,
    };
  }
  const revision = value.catalogRevision;
  if (
    typeof revision !== "string" ||
    !/^\d{1,10}$/.test(revision) ||
    BigInt(revision) < 1n ||
    BigInt(revision) > 2147483647n
  )
    invalidPosInput();
  return {
    productId: inputUuid(value.productId, "productId"),
    ...measured(() => captureQuantity(value.quantity, quantityUnit)),
    catalogRevision: String(BigInt(revision)),
  };
}

export type TrustedPosLineSnapshot = Pick<
  PosLineV2,
  "lineId" | "productId" | "name" | "quantity" | "unitPrice" | "measure"
>;
/** Step two is mandatory for existing lines. The service supplies rows belonging to its
 * locked order, never a body snapshot. This pure comparison does not establish ownership. */
export function resolveExistingMeasuredLine(
  input: PosExistingLineV2,
  source: TrustedPosLineSnapshot | undefined,
): TrustedPosLineSnapshot {
  if (
    !source ||
    input.lineId !== inputUuid(source.lineId, "lineId") ||
    input.productId !==
      (source.productId === null
        ? null
        : inputUuid(source.productId, "productId"))
  )
    invalidPosInput();
  const measure = measured(() => parseMeasure(source.measure));
  if ((measure.kind === "unit") !== (input.quantityUnit === "unit"))
    throw new CounterError(
      422,
      "invalid_measure",
      "No puedes cambiar el tipo de medida de la línea.",
    );
  const unchangedUnit =
    measure.kind === "unit" &&
    input.quantityUnit === "unit" &&
    input.quantity ===
      measured(() => trustedUnitSnapshotQuantity(source.quantity));
  const capture = unchangedUnit
    ? { quantity: input.quantity, quantityUnit: "unit" as const }
    : measured(() => captureQuantity(input.quantity, input.quantityUnit));
  return {
    lineId: source.lineId,
    productId: source.productId,
    name: source.name,
    quantity: capture.quantity,
    unitPrice: source.unitPrice,
    measure:
      measure.kind === "unit"
        ? { ...measure }
        : {
            ...measure,
            quantityUnit: capture.quantityUnit as "kg" | "lb" | "g",
          },
  };
}
