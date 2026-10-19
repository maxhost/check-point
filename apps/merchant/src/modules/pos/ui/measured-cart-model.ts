import {
  trustedUnitSnapshotQuantity,
  captureQuantity,
  presentQuantity,
  exactSnapshotLineGross,
  normalizedGross,
  CONVERSION_VERSION,
  type MeasureUnit,
  type MassUnit,
  type QuantityCapture,
} from "@mi-pasaporte/domain/measures";
import {
  add,
  fromExact,
  rational,
} from "@mi-pasaporte/domain/financial/rational";
import {
  type PosLineV2,
  type PosCatalogProductV2,
  type PosExistingLineV2,
  type PosNewLineV2,
} from "../contracts";

export type QuantityEditor = {
  source: QuantityCapture | null;
  unit: MeasureUnit;
  buffer: string;
  edited: boolean;
};
export type MeasuredCartLine = {
  key: string;
  snapshot: PosLineV2;
  origin: { kind: "existing" } | { kind: "new"; catalogRevision: string };
  editor: QuantityEditor;
};
export const unitLabel = (unit: MeasureUnit) =>
  ({ unit: "unidad", kg: "kg", lb: "lb", g: "g" })[unit];
export function quantityEditor(
  source: QuantityCapture | null,
  unit: MeasureUnit,
): QuantityEditor {
  return { source, unit, buffer: source?.quantity ?? "", edited: false };
}
export function editorPresentation(editor: QuantityEditor) {
  if (editor.edited || !editor.source)
    return { display: editor.buffer, approximate: false };
  // Historical unit quantities may exceed the new capture bounds, without being edited.
  if (editor.source.quantityUnit === "unit" && editor.unit === "unit")
    return {
      display: trustedUnitSnapshotQuantity(editor.source.quantity),
      approximate: false,
    };
  return presentQuantity(editor.source, editor.unit);
}
export function changePresentation(
  editor: QuantityEditor,
  unit: MeasureUnit,
): QuantityEditor {
  // A partial manual edit belongs to its selected unit; never reinterpret it on selection.
  if (editor.edited)
    throw new Error(
      "Confirma o cancela la cantidad antes de cambiar la unidad.",
    );
  if (
    (editor.source?.quantityUnit === "unit") !== (unit === "unit") &&
    editor.source
  )
    throw new Error("Elige una unidad de la misma medida.");
  return { ...editor, unit };
}
export function editQuantity(
  editor: QuantityEditor,
  buffer: string,
): QuantityEditor {
  return { ...editor, buffer, edited: true };
}
export function resolveQuantity(
  editor: QuantityEditor,
  enabled: readonly MassUnit[],
): QuantityCapture {
  if (!editor.edited && editor.source) return editor.source;
  if (editor.unit !== "unit" && !enabled.includes(editor.unit))
    throw new Error(
      "Esta unidad ya no está habilitada. Elige otra unidad para capturar.",
    );
  try {
    return captureQuantity(editor.buffer.replace(",", "."), editor.unit);
  } catch {
    throw new Error(
      editor.unit === "unit"
        ? "Escribe una cantidad entera entre 1 y 999999999."
        : "Escribe una cantidad mayor que 0, hasta 999999999 y 9 decimales.",
    );
  }
}
export function existingCartLine(snapshot: PosLineV2): MeasuredCartLine {
  const copy = structuredClone(snapshot);
  return {
    key: copy.lineId,
    snapshot: copy,
    origin: { kind: "existing" },
    editor: quantityEditor(
      { quantity: copy.quantity, quantityUnit: copy.measure.quantityUnit },
      copy.measure.quantityUnit,
    ),
  };
}
export function newCartLine(
  product: PosCatalogProductV2,
  key: string,
  editor: QuantityEditor,
  enabled: readonly MassUnit[],
): MeasuredCartLine {
  if (product.unitPrice === null)
    throw new Error("Este producto no tiene precio de venta.");
  const quantity = captureQuantity(
    resolveQuantity(editor, enabled).quantity,
    editor.source && !editor.edited ? editor.source.quantityUnit : editor.unit,
  );
  if (
    quantity.quantityUnit !== "unit" &&
    !enabled.includes(quantity.quantityUnit)
  )
    throw new Error("Esta unidad ya no está habilitada.");
  if (
    product.soldByWeight !== (quantity.quantityUnit !== "unit") ||
    product.soldByWeight !== (product.pricingUnit !== "unit")
  )
    throw new Error("La cantidad y el producto tienen medidas distintas.");
  const measure = product.soldByWeight
    ? {
        kind: "mass" as const,
        quantityUnit: quantity.quantityUnit as MassUnit,
        priceUnit: product.pricingUnit as MassUnit,
        conversionVersion: CONVERSION_VERSION,
      }
    : {
        kind: "unit" as const,
        quantityUnit: "unit" as const,
        priceUnit: "unit" as const,
        conversionVersion: CONVERSION_VERSION,
      };
  const snapshot = {
    lineId: key,
    productId: product.id,
    name: product.name,
    unitPrice: product.unitPrice,
    quantity: quantity.quantity,
    measure,
    lineTotal: "0",
  };
  exactSnapshotLineGross(
    snapshot.quantity,
    snapshot.unitPrice,
    snapshot.measure,
  );
  return {
    key,
    snapshot,
    origin: { kind: "new", catalogRevision: product.catalogRevision },
    editor: quantityEditor(quantity, quantity.quantityUnit),
  };
}
export function resolvedCartLine(
  line: MeasuredCartLine,
  enabled: readonly MassUnit[],
): PosLineV2 {
  const quantity = resolveQuantity(line.editor, enabled);
  if (
    (line.snapshot.measure.kind === "unit") !==
    (quantity.quantityUnit === "unit")
  )
    throw new Error("La unidad no corresponde al producto.");
  return {
    ...line.snapshot,
    quantity: quantity.quantity,
    measure: {
      ...line.snapshot.measure,
      quantityUnit: quantity.quantityUnit,
    } as PosLineV2["measure"],
  };
}
export function cartLineAmount(
  line: MeasuredCartLine,
  enabled: readonly MassUnit[],
  currency: string,
): string {
  const resolved = resolvedCartLine(line, enabled);
  return normalizedGross(
    fromExact(
      exactSnapshotLineGross(
        resolved.quantity,
        resolved.unitPrice,
        resolved.measure,
      ),
    ),
    currency,
  );
}
export function serializeMeasuredCart(
  lines: readonly MeasuredCartLine[],
  enabled: readonly MassUnit[],
  currency: string,
): (PosExistingLineV2 | PosNewLineV2)[] {
  if (lines.length > 200) throw new Error("Puedes añadir hasta 200 líneas.");
  const keys = new Set<string>();
  let total = rational(0n);
  const items = lines.map((line) => {
    if (keys.has(line.key)) throw new Error("Hay una línea duplicada.");
    keys.add(line.key);
    const resolved = resolvedCartLine(line, enabled);
    total = add(
      total,
      fromExact(
        exactSnapshotLineGross(
          resolved.quantity,
          resolved.unitPrice,
          resolved.measure,
        ),
      ),
    );
    const quantity = {
      quantity: resolved.quantity,
      quantityUnit: resolved.measure.quantityUnit,
    };
    if (line.origin.kind === "existing")
      return {
        lineId: resolved.lineId,
        productId: resolved.productId,
        ...quantity,
      };
    if (!resolved.productId)
      throw new Error("El producto nuevo no está disponible.");
    return {
      productId: resolved.productId,
      catalogRevision: line.origin.catalogRevision,
      ...quantity,
    };
  });
  normalizedGross(total, currency);
  return items;
}
export function appendCartLine(
  lines: readonly MeasuredCartLine[],
  line: MeasuredCartLine,
): MeasuredCartLine[] {
  if (lines.length >= 200) throw new Error("Puedes añadir hasta 200 líneas.");
  if (lines.some((item) => item.key === line.key))
    throw new Error("Esta línea ya se añadió.");
  return [...lines, line];
}
