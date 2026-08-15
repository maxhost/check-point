export type Product = {
  id: string;
  name: string;
  categoryId: string | null;
  unitPrice: number | null;
  unitCost: number | null;
  imagePath: string | null;
  imageVersion: number;
  availableAllLocations: boolean;
  locationIds: string[];
};

export type Category = { id: string; name: string };
export type Location = { id: string; name: string };

export type Catalog = {
  products: Product[];
  categories: Category[];
  locations: Location[];
  currencyCode: string;
};

export type ProductPayload = {
  name: string;
  categoryId: string | null;
  unitPrice: number | null;
  unitCost: number | null;
  availableAllLocations: boolean;
  locationIds: string[];
  imageAction: "keep" | "replace" | "remove";
  uploadId?: string;
};

/** Formats an amount in the business currency; falls back to the raw number on bad ISO. */
export function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
