export type Product = {
  id: string;
  name: string;
  categoryId: string | null;
  unitPrice: number | null;
  unitCost: number | null;
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
};

export type ProductPayload = {
  name: string;
  categoryId: string | null;
  unitPrice: number | null;
  unitCost: number | null;
  availableAllLocations: boolean;
  locationIds: string[];
  imageAction: "keep" | "replace" | "remove" | "stock";
  uploadId?: string;
  provider?: string;
  photoId?: string;
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
