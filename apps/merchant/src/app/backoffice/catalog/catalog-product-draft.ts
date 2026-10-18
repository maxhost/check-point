import { parsePrice } from "@mi-pasaporte/domain/measures";
import type { Product, ProductPayload } from "./types";

export type SaveResult =
  | boolean
  | {
      code: string;
      product?: Product;
      message: string;
    };
export class CatalogWriteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly product?: Product,
  ) {
    super(message);
  }
}
export function draftPrice(
  value: string,
  original: string | null | undefined,
  preserve: boolean,
) {
  if (value === "") return null;
  if (preserve && value === original) return original;
  return parsePrice(value);
}
export const commercialFields = {
  name: "Nombre",
  categoryId: "Categoría",
  unitPrice: "Precio de venta",
  unitCost: "Precio de costo",
  soldByWeight: "Venta por peso",
  pricingUnit: "Unidad de venta",
  availableAllLocations: "Disponibilidad",
  locationIds: "Locales",
} as const;
type Field = keyof typeof commercialFields;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function reconcileProduct(
  base: Product,
  draft: ProductPayload,
  remote: Product,
) {
  const next = { ...draft, expectedSalesRevision: remote.catalogRevision };
  const overlaps: string[] = [];
  const measure = (source: Product | ProductPayload) => [
    source.soldByWeight,
    source.pricingUnit,
  ];
  const measureChanged =
    !equal(measure(base), measure(draft)) ||
    !equal(measure(base), measure(remote));
  const groups: Field[][] = [
    ["name"],
    ["categoryId"],
    ...(measureChanged
      ? [["soldByWeight", "pricingUnit", "unitPrice", "unitCost"] as Field[]]
      : ([
          ["soldByWeight", "pricingUnit"],
          ["unitPrice"],
          ["unitCost"],
        ] as Field[][])),
    ["availableAllLocations", "locationIds"],
  ];
  for (const fields of groups) {
    const values = (source: Product | ProductPayload) =>
      fields.map((field) => source[field]);
    if (equal(values(draft), values(base))) {
      for (const field of fields)
        Object.assign(next, { [field]: remote[field] });
    } else if (
      !equal(values(remote), values(base)) &&
      !equal(values(draft), values(remote))
    ) {
      overlaps.push(fields.map((field) => commercialFields[field]).join(" / "));
    }
  }
  if (draft.imageAction !== "keep" && remote.imagePath !== base.imagePath)
    overlaps.push("Imagen");
  return { next, overlaps };
}
