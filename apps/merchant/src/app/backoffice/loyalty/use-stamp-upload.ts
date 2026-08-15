import { useEffect, useState } from "react";
import {
  ACCEPTED_IMAGE_CONTENT_TYPE_SET,
  ACCEPTED_IMAGE_LABEL,
} from "../../../lib/image-formats";

/**
 * Client state for the deferred stamp image: choosing or removing only changes the
 * draft. `upload()` pushes the selected file to R2 via a signed URL and returns the
 * temporary upload id to send with the program save; nothing touches R2 or the DB
 * until the program itself is saved.
 */
export function useStampUpload() {
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
    if (!ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(file.type)) {
      onError(`El sello debe ser ${ACCEPTED_IMAGE_LABEL}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("El sello debe pesar como máximo 5 MB.");
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

  function reset() {
    setSelected(null);
    setRemoved(false);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  async function upload(): Promise<string | null> {
    if (!selected) return null;
    const prepared = await fetch("/api/loyalty-program/stamp-upload", {
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
        preparation?.error ?? "No pudimos preparar la carga del sello.",
      );
    }
    const uploaded = await fetch(preparation.uploadUrl, {
      method: "PUT",
      headers: { "content-type": selected.type },
      body: selected,
    });
    if (!uploaded.ok)
      throw new Error("No pudimos cargar el sello. Intenta nuevamente.");
    return preparation.uploadId;
  }

  const action = selected ? "replace" : removed ? "remove" : "keep";
  return { selected, preview, removed, action, choose, remove, reset, upload };
}

export type StampUpload = ReturnType<typeof useStampUpload>;
