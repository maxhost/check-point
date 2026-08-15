import { useEffect, useState } from "react";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Client state for the deferred product image: choosing or removing only changes the
 * draft. `upload()` pushes the selected file to R2 via a signed URL and returns the
 * temporary upload id to send with the product save; nothing touches R2 or the DB
 * until the product itself is saved. Mirrors `useStampUpload`.
 */
export function useCatalogImage(initialPath: string | null) {
  const [selected, setSelected] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

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
    setSelected(file);
    setRemoved(false);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  function remove() {
    setSelected(null);
    setRemoved(true);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
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

  const action: "keep" | "replace" | "remove" = selected
    ? "replace"
    : removed
      ? "remove"
      : "keep";
  const visible = preview ?? (!removed ? initialPath : null);
  return {
    selected,
    preview,
    removed,
    visible,
    action,
    choose,
    remove,
    upload,
  };
}
