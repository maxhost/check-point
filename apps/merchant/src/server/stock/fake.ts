import type {
  ResolvedStockPhoto,
  StockPhoto,
  StockPhotoProvider,
} from "./provider";

/** A tiny inline SVG placeholder so dev/test needs no network for previews. */
function placeholder(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#e7f4eb"/><text x="80" y="84" font-size="14" text-anchor="middle" fill="#176548">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Deterministic, network-free provider for dev and integration tests. */
export const fakeProvider: StockPhotoProvider = {
  id: "fake",

  async search(query, page = 1) {
    const q = query.trim() || "demo";
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    return Array.from({ length: 6 }, (_, i): StockPhoto => {
      const n = (safePage - 1) * 6 + i + 1;
      return {
        id: `fake-${n}`,
        thumbUrl: placeholder(`${q} ${n}`),
        previewUrl: placeholder(`${q} ${n}`),
        author: `Autor ${n}`,
        authorUrl: "https://example.test/autor",
        sourceUrl: "https://example.test/foto",
        width: 400,
        height: 400,
      };
    });
  },

  async resolve(): Promise<ResolvedStockPhoto> {
    // A real, small PNG so the shared `normalizeImage` accepts it.
    const sharp = (await import("sharp")).default;
    const bytes = await sharp({
      create: { width: 240, height: 240, channels: 3, background: "#176548" },
    })
      .png()
      .toBuffer();
    return {
      bytes,
      contentType: "image/png",
      author: "Autor Demo",
      authorUrl: "https://example.test/autor",
      sourceUrl: "https://example.test/foto",
    };
  },
};
