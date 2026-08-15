import { useEffect, useState } from "react";
import type { ImageCredit, StockPhoto } from "./types";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type StockChoice = {
  provider: string;
  photoId: string;
  previewUrl: string;
  author: string;
  authorUrl: string;
  sourceUrl: string;
};

/**
 * Deferred product image: choosing a file, picking a stock photo, or removing only changes
 * the draft. `upload()` pushes a chosen file to R2 and returns its temporary id; a stock pick
 * travels as `{ provider, photoId }` and the server downloads it on save. Nothing touches R2
 * or the DB until the product is saved.
 */
export function useCatalogImage(
  initialPath: string | null,
  initialCredit: ImageCredit | null,
) {
  const [selected, setSelected] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [stock, setStock] = useState<StockChoice | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function clearPreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function choose(file: File | undefined, onError: (message: string) => void) {
    if (!file) return;
    if (!imageTypes.has(file.type)) {
      onError("La imagen debe ser PNG, JPEG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("La imagen debe pesar como máximo 5 MB.");
      return;
    }
    setStock(null);
    setSelected(file);
    setRemoved(false);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  function chooseStock(provider: string, photo: StockPhoto) {
    setSelected(null);
    setRemoved(false);
    clearPreview();
    setStock({
      provider,
      photoId: photo.id,
      previewUrl: photo.previewUrl,
      author: photo.author,
      authorUrl: photo.authorUrl,
      sourceUrl: photo.sourceUrl,
    });
  }

  function remove() {
    setSelected(null);
    setStock(null);
    setRemoved(true);
    clearPreview();
  }

  async function upload(): Promise<string | null> {
    if (!selected) return null;
    const prepared = await fetch("/api/catalog/product/image-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: selected.type,
        byteSize: selected.size,
      }),
    });
    const preparation = (await prepared.json().catch(() => null)) as {
      uploadId?: string;
      uploadUrl?: string;
      error?: string;
    } | null;
    if (!prepared.ok || !preparation?.uploadId || !preparation.uploadUrl) {
      throw new Error(
        preparation?.error ?? "No pudimos preparar la carga de la imagen.",
      );
    }
    const uploaded = await fetch(preparation.uploadUrl, {
      method: "PUT",
      headers: { "content-type": selected.type },
      body: selected,
    });
    if (!uploaded.ok)
      throw new Error("No pudimos cargar la imagen. Intenta nuevamente.");
    return preparation.uploadId;
  }

  const action: "keep" | "replace" | "remove" | "stock" = selected
    ? "replace"
    : stock
      ? "stock"
      : removed
        ? "remove"
        : "keep";

  const visible = stock
    ? stock.previewUrl
    : (preview ?? (!removed ? initialPath : null));

  // Attribution to show: the fresh stock pick, or the stored credit if unchanged.
  const credit: ImageCredit | null = stock
    ? {
        source: stock.provider,
        author: stock.author,
        authorUrl: stock.authorUrl,
        sourceUrl: stock.sourceUrl,
      }
    : action === "keep" && !removed
      ? initialCredit
      : null;

  return {
    selected,
    stock,
    visible,
    action,
    credit,
    choose,
    chooseStock,
    remove,
    upload,
  };
}
