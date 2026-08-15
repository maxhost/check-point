import { MAX_LOGO_BYTES, readObjectAtMost } from "../r2";
import {
  StockError,
  type ResolvedStockPhoto,
  type StockPhoto,
  type StockPhotoProvider,
} from "./provider";

// Anti-SSRF: the server only downloads bytes from the provider's own image host.
const ALLOWED_HOSTS = new Set(["images.pexels.com"]);

function apiKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key)
    throw new StockError(503, "El buscador de imágenes no está configurado.");
  return key;
}

async function pexelsGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.pexels.com/v1/${path}`, {
    headers: { Authorization: apiKey() },
  });
  if (res.status === 429) {
    throw new StockError(
      429,
      "Demasiadas búsquedas. Probá de nuevo en un momento.",
    );
  }
  if (!res.ok) {
    throw new StockError(502, "No pudimos consultar el buscador de imágenes.");
  }
  return (await res.json()) as Record<string, unknown>;
}

type PexelsPhoto = {
  id: number;
  width?: number;
  height?: number;
  url?: string;
  photographer?: string;
  photographer_url?: string;
  src?: Record<string, string>;
};

function toStockPhoto(photo: PexelsPhoto): StockPhoto {
  const src = photo.src ?? {};
  return {
    id: String(photo.id),
    thumbUrl: src.tiny ?? src.small ?? src.medium ?? "",
    previewUrl: src.large ?? src.medium ?? src.original ?? "",
    author: photo.photographer ?? "Autor desconocido",
    authorUrl: photo.photographer_url ?? "https://www.pexels.com",
    sourceUrl: photo.url ?? "https://www.pexels.com",
    width: Number(photo.width) || 0,
    height: Number(photo.height) || 0,
  };
}

export const pexelsProvider: StockPhotoProvider = {
  id: "pexels",

  async search(query, page = 1) {
    const q = query.trim();
    if (!q) throw new StockError(422, "Escribe algo para buscar.");
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const data = await pexelsGet(
      `search?query=${encodeURIComponent(q)}&per_page=24&page=${safePage}`,
    );
    const photos = Array.isArray(data.photos)
      ? (data.photos as PexelsPhoto[])
      : [];
    return photos.map(toStockPhoto);
  },

  async resolve(photoId): Promise<ResolvedStockPhoto> {
    if (!/^[0-9]+$/.test(photoId)) throw new StockError(422, "Foto inválida.");
    const photo = (await pexelsGet(`photos/${photoId}`)) as PexelsPhoto;
    const src = photo.src ?? {};
    const downloadUrl = src.large2x ?? src.large ?? src.original;
    if (typeof downloadUrl !== "string") {
      throw new StockError(502, "La imagen no está disponible.");
    }
    // Anti-SSRF: parse and require https + an allow-listed host before fetching.
    let url: URL;
    try {
      url = new URL(downloadUrl);
    } catch {
      throw new StockError(502, "URL de imagen inválida.");
    }
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
      throw new StockError(502, "Origen de imagen no permitido.");
    }
    const res = await fetch(url, { redirect: "error" });
    if (!res.ok || !res.body) {
      throw new StockError(502, "No pudimos descargar la imagen.");
    }
    const bytes = await readObjectAtMost(res.body, MAX_LOGO_BYTES);
    return {
      bytes,
      contentType: res.headers.get("content-type") ?? "image/jpeg",
      author: photo.photographer ?? "Autor desconocido",
      authorUrl: photo.photographer_url ?? "https://www.pexels.com",
      sourceUrl: photo.url ?? "https://www.pexels.com",
    };
  },
};
