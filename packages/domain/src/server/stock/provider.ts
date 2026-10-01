export class StockError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** A search result: only URLs and attribution the client may see (never our API key). */
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

/** A resolved photo ready to process into R2, with the attribution to persist. */
export type ResolvedStockPhoto = {
  bytes: Buffer;
  contentType: string;
  author: string;
  authorUrl: string;
  sourceUrl: string;
};

export interface StockPhotoProvider {
  id: string;
  search(query: string, page?: number): Promise<StockPhoto[]>;
  resolve(photoId: string): Promise<ResolvedStockPhoto>;
}

/**
 * The active provider, selected by `STOCK_PROVIDER` (default `pexels`; `fake` for dev/test).
 * Dynamic import keeps this module free of a static cycle with the implementations.
 */
export async function getStockProvider(): Promise<StockPhotoProvider> {
  const name = process.env.STOCK_PROVIDER ?? "pexels";
  if (name === "fake") return (await import("./fake")).fakeProvider;
  if (name === "pexels") return (await import("./pexels")).pexelsProvider;
  throw new StockError(503, "El buscador de imágenes no está configurado.");
}
