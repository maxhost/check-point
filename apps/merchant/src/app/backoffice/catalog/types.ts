import type { MassUnit, MeasureUnit } from "@mi-pasaporte/domain/measures";
export type { MassUnit, MeasureUnit };

export type Product = {
  id: string;
  name: string;
  categoryId: string | null;
  unitPrice: string | null;
  unitCost: string | null;
  soldByWeight: boolean;
  pricingUnit: MeasureUnit;
  catalogRevision: string;
  imagePath: string | null;
  imageVersion: number;
  imageSource: string | null;
  imageAuthor: string | null;
  imageAuthorUrl: string | null;
  imageSourceUrl: string | null;
  availableAllLocations: boolean;
  locationIds: string[];
};

/** A stock search result (spec 0035); mirrors the server `StockPhoto`. */
export type StockPhoto = {
  id: string;
  thumbUrl: string;
  previewUrl: string;
  author: string;
  authorUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
};

/** Attribution shown in the editor and persisted for stock images. */
export type ImageCredit = {
  source: string | null;
  author: string | null;
  authorUrl: string | null;
  sourceUrl: string | null;
};

export type Category = { id: string; name: string };
export type Location = { id: string; name: string };

export type Catalog = {
  products: Product[];
  categories: Category[];
  locations: Location[];
  currencyCode: string;
  salesMassUnits: MassUnit[];
  /** ADR 0086 — hay una importacion ABIERTA, asi que el alta manual esta bloqueada en el
   * servidor (409). La pantalla solo lo refleja: no es la que protege. */
  importInProgress: boolean;
};

export type ProductPayload = {
  name: string;
  categoryId: string | null;
  unitPrice: string | null;
  unitCost: string | null;
  availableAllLocations: boolean;
  locationIds: string[];
  soldByWeight: boolean;
  pricingUnit: MeasureUnit;
  expectedSalesRevision?: string;
  imageAction: "keep" | "replace" | "remove" | "stock";
  uploadId?: string;
  /** Only travels with `replace`: the blob came from the 1:1 client cropper (spec 0040). */
  cropped?: boolean;
  provider?: string;
  photoId?: string;
};

export const unitLabels = {
  unit: "unidad",
  kg: "kilogramo",
  lb: "libra",
  g: "gramo",
} as const;

/** Preserve every significant fractional digit; Intl only formats the integer and currency. */
export function formatMoney(amount: string, currencyCode: string): string {
  const [whole, fraction = ""] = amount.split(".");
  const significant = fraction.replace(/0+$/, "");
  try {
    const formatter = new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: currencyCode,
    });
    const minimum = formatter.resolvedOptions().minimumFractionDigits ?? 0;
    const decimals = significant.padEnd(minimum, "0");
    const parts = formatter.formatToParts(BigInt(whole));
    const decimal =
      new Intl.NumberFormat("es-EC")
        .formatToParts(1.1)
        .find((part) => part.type === "decimal")?.value ?? ",";
    const lastInteger = parts.findLastIndex((part) => part.type === "integer");
    const formatted = parts
      .map((part) =>
        part.type === "fraction"
          ? decimals
          : part.type === "decimal"
            ? decimals
              ? part.value
              : ""
            : part.value,
      )
      .join("");
    return parts.some((part) => part.type === "fraction") || !decimals
      ? formatted
      : parts
          .map(
            (part, index) =>
              part.value + (index === lastInteger ? decimal + decimals : ""),
          )
          .join("");
  } catch {
    return `${currencyCode} ${amount}`;
  }
}
