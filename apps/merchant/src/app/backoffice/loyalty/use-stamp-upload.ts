import { useEffect, useState } from "react";
import {
  ACCEPTED_IMAGE_LABEL,
  isAcceptedImageType,
} from "../../../lib/image-formats";
import {
  canDecodeImage,
  croppedFileName,
  decideImageChoice,
} from "../../../lib/crop-image";

/**
 * Client state for the deferred stamp image: choosing or removing only changes the
 * draft. `upload()` pushes the selected file to R2 via a signed URL and returns the
 * temporary upload id to send with the program save; nothing touches R2 or the DB
 * until the program itself is saved.
 *
 * Same crop flow as `useBrandLogo` (spec 0040): a decodable file waits in `pending` for the
 * 1:1 cropper, an undecodable one (HEIC outside Safari — ADR 0047) falls back silently to
 * uploading the original. The `<input>` lives in the step component, so `cancelCrop` only
 * drops the candidate and the caller clears its own input.
 */
export function useStampUpload() {
  const [selected, setSelected] = useState<File | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [cropped, setCropped] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

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
      onError(`El sello debe ser ${ACCEPTED_IMAGE_LABEL}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("El sello debe pesar como máximo 5 MB.");
      return;
    }
    const choice = decideImageChoice(file, await canDecodeImage(file));
    if (choice.mode === "crop") {
      setPending(choice.pending);
      return;
    }
    // Fallback (ADR 0047 §1): the original file is uploaded untouched.
    setPending(null);
    setCropped(choice.cropped);
    setSelected(choice.selected);
    setRemoved(false);
    show(choice.selected);
  }

  function applyCrop(blob: Blob, type: string) {
    const source = pending;
    if (!source) return;
    const file = new File([blob], croppedFileName(source.name, type), { type });
    setPending(null);
    setCropped(true);
    setSelected(file);
    setRemoved(false);
    show(file);
  }

  function cancelCrop() {
    setPending(null);
  }

  function remove() {
    setSelected(null);
    setPending(null);
    setCropped(false);
    setRemoved(true);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  function reset() {
    setSelected(null);
    setPending(null);
    setCropped(false);
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
  return {
    selected,
    pending,
    cropped,
    preview,
    removed,
    action,
    choose,
    applyCrop,
    cancelCrop,
    remove,
    reset,
    upload,
  };
}

export type StampUpload = ReturnType<typeof useStampUpload>;
