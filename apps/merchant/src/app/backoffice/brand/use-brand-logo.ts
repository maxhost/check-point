import { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_IMAGE_LABEL,
  isAcceptedImageType,
} from "../../../lib/image-formats";
import { croppedFileName, decideImageChoice } from "../../../lib/crop-image";
import { resolveDecodableImage } from "../../../lib/image-decode-probe";

/**
 * Client state for the deferred brand logo: choosing or removing only changes the
 * draft. `upload()` pushes the selected file to R2 via a signed URL and returns the
 * temporary upload id to send with the brand save. Mirrors `useCatalogImage`.
 *
 * Choosing a file the browser can decode parks it in `pending` and the page opens the 1:1
 * cropper (spec 0040); `applyCrop` promotes the cropped blob to `selected`. If the browser
 * cannot decode it (HEIC outside Safari — ADR 0047) `choose` falls back **silently** to the
 * pre-cropper behaviour: the original file becomes `selected` and the server does the work.
 */
export function useBrandLogo() {
  const [selected, setSelected] = useState<File | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  // The src the probe proved loadable, handed straight to the cropper (spec 0052 §3), plus
  // its release function: this hook owns the object URL, the modal only renders it.
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const releasePending = useRef<(() => void) | null>(null);
  const [cropped, setCropped] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
    if (!isAcceptedImageType(file.type)) {
      onError(`El logo debe ser ${ACCEPTED_IMAGE_LABEL}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("El logo debe pesar como máximo 5 MB.");
      return;
    }
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
    // Fallback (ADR 0047 §1): the original file is uploaded untouched.
    dropPending();
    setCropped(choice.cropped);
    setSelected(choice.selected);
    setRemoved(false);
    show(choice.selected);
  }

  /** Promotes the cropper's square blob to the file that will be uploaded. */
  function applyCrop(blob: Blob, type: string) {
    const source = pending;
    if (!source) return;
    const file = new File([blob], croppedFileName(source.name, type), { type });
    dropPending();
    setCropped(true);
    setSelected(file);
    setRemoved(false);
    show(file);
  }

  /** Drops the candidate without touching `selected`; clears the input so the same file re-fires. */
  function cancelCrop() {
    dropPending();
    if (fileInput.current) fileInput.current.value = "";
  }

  function remove() {
    setSelected(null);
    dropPending();
    setCropped(false);
    setRemoved(true);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  function reset() {
    setSelected(null);
    dropPending();
    setCropped(false);
    setRemoved(false);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  async function upload(): Promise<string | null> {
    if (!selected) return null;
    const prepared = await fetch("/api/brand/logo-upload", {
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
        preparation?.error ?? "No pudimos preparar la carga del logo.",
      );
    }
    const uploaded = await fetch(preparation.uploadUrl, {
      method: "PUT",
      headers: { "content-type": selected.type },
      body: selected,
    });
    if (!uploaded.ok)
      throw new Error("No pudimos cargar el logo. Intenta nuevamente.");
    return preparation.uploadId;
  }

  const action: "keep" | "replace" | "remove" = selected
    ? "replace"
    : removed
      ? "remove"
      : "keep";
  return {
    selected,
    pending,
    pendingSrc,
    cropped,
    preview,
    removed,
    action,
    fileInput,
    choose,
    applyCrop,
    cancelCrop,
    remove,
    reset,
    upload,
  };
}
