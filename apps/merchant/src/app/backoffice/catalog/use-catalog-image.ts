import { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_IMAGE_LABEL,
  isAcceptedImageType,
} from "../../../lib/image-formats";
import { croppedFileName, decideImageChoice } from "../../../lib/crop-image";
import { resolveDecodableImage } from "../../../lib/image-decode-probe";
import type { ImageCredit, StockPhoto } from "./types";

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
  const [pending, setPending] = useState<File | null>(null);
  // The src the probe proved loadable, handed straight to the cropper (spec 0052 §3), plus
  // its release function: this hook owns the object URL, the modal only renders it.
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const releasePending = useRef<(() => void) | null>(null);
  const [cropped, setCropped] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [stock, setStock] = useState<StockChoice | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // Unmounting mid-crop must not leak the probe's object URL either.
  useEffect(() => () => releasePending.current?.(), []);

  /** Drops the crop candidate and releases the src the probe resolved for it. */
  function dropPending() {
    releasePending.current?.();
    releasePending.current = null;
    setPending(null);
    setPendingSrc(null);
  }

  function clearPreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function show(file: File) {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  async function choose(
    file: File | undefined,
    onError: (message: string) => void,
  ) {
    if (!file) return;
    // The server sniffs the real bytes; this guard mirrors the presign allow-list so an SVG
    // (or a file the picker reports with an empty type) gets a message naming the accepted
    // formats here instead of a generic presign failure — same criterion as brand/stamp.
    if (!isAcceptedImageType(file.type)) {
      onError(`La imagen debe ser ${ACCEPTED_IMAGE_LABEL}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("La imagen debe pesar como máximo 5 MB.");
      return;
    }
    // Decodable → park it for the 1:1 cropper. Undecodable (HEIC outside Safari, ADR 0047)
    // → silent fallback to the pre-cropper behaviour: the original file, untouched.
    const resolved = await resolveDecodableImage(file);
    const choice = decideImageChoice(file, resolved !== null);
    if (choice.mode === "crop") {
      // `crop` is returned exactly when the probe resolved; the guard is for the compiler.
      if (!resolved) return;
      releasePending.current?.();
      releasePending.current = resolved.cleanup;
      setPending(choice.pending);
      setPendingSrc(resolved.src);
      return;
    }
    dropPending();
    setCropped(choice.cropped);
    setStock(null);
    setSelected(choice.selected);
    setRemoved(false);
    show(choice.selected);
  }

  function applyCrop(blob: Blob, type: string) {
    const source = pending;
    if (!source) return;
    const file = new File([blob], croppedFileName(source.name, type), { type });
    dropPending();
    setCropped(true);
    setStock(null);
    setSelected(file);
    setRemoved(false);
    show(file);
  }

  function cancelCrop() {
    dropPending();
  }

  function chooseStock(provider: string, photo: StockPhoto) {
    setSelected(null);
    dropPending();
    setCropped(false);
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
    dropPending();
    setCropped(false);
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
    pending,
    pendingSrc,
    cropped,
    stock,
    visible,
    action,
    credit,
    choose,
    applyCrop,
    cancelCrop,
    chooseStock,
    remove,
    upload,
  };
}

export type CatalogImage = ReturnType<typeof useCatalogImage>;
