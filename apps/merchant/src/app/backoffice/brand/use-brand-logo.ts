import { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_IMAGE_CONTENT_TYPE_SET,
  ACCEPTED_IMAGE_LABEL,
} from "../../../lib/image-formats";

/**
 * Client state for the deferred brand logo: choosing or removing only changes the
 * draft. `upload()` pushes the selected file to R2 via a signed URL and returns the
 * temporary upload id to send with the brand save. Mirrors `useCatalogImage`.
 */
export function useBrandLogo() {
  const [selected, setSelected] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function choose(file: File | undefined, onError: (message: string) => void) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(file.type)) {
      onError(`El logo debe ser ${ACCEPTED_IMAGE_LABEL}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("El logo debe pesar como máximo 5 MB.");
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
    if (fileInput.current) fileInput.current.value = "";
  }

  function reset() {
    setSelected(null);
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
    preview,
    removed,
    action,
    fileInput,
    choose,
    remove,
    reset,
    upload,
  };
}
