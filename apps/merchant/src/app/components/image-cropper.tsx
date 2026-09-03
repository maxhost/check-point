"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import {
  cropImageToBlob,
  loadImageElement,
  type CropArea,
  type CropSurface,
} from "../../lib/crop-image";

type Props = {
  file: File;
  surface: CropSurface;
  onDone: (blob: Blob, type: string) => void;
  onCancel: () => void;
};

/**
 * 1:1 crop modal (spec 0040). **This is the only module in the repo that imports
 * `react-easy-crop`**, and it is always mounted through `next/dynamic({ ssr: false })`, so
 * the library lands in a chunk that is fetched when the user picks an image and never in
 * the initial page bundle (ADR 0041 §3).
 *
 * `react-easy-crop` injects its own stylesheet at runtime (`disableAutomaticStylesInjection`
 * defaults to false), so there is no CSS import to keep in the deferred chunk; only the
 * modal chrome lives in `globals.css`.
 *
 * All three surfaces render square with `object-fit: cover` today, so the crop does not add
 * a constraint — it hands the user control over a centre-crop that already happened blind.
 */
export default function ImageCropper({
  file,
  surface,
  onDone,
  onCancel,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function confirm() {
    if (!url || !area) return;
    setBusy(true);
    setError(null);
    try {
      // Re-loading the same object URL is cache-cheap and gives us an <img> the browser has
      // already oriented via EXIF, which is what `drawImage` must receive.
      const image = await loadImageElement(url);
      const result = await cropImageToBlob({ image, area, surface });
      onDone(result.blob, result.type);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos recortar la imagen.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <section
        className="image-cropper"
        role="dialog"
        aria-modal="true"
        aria-label="Recortar imagen"
      >
        <header className="image-cropper-head">
          <h2>Encuadra tu imagen</h2>
        </header>
        <div className="image-cropper-stage">
          {url && (
            <Cropper
              image={url}
              aspect={1}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={4}
              showGrid
              restrictPosition
              zoomWithScroll
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>
        <label className="image-cropper-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={zoom}
            aria-label="Zoom"
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <p className="field-help">
          Arrastra para mover y usa el zoom. Se guarda el cuadrado visible.
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="image-cropper-actions">
          <button
            className="button alt"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="button"
            type="button"
            disabled={busy || !area}
            onClick={() => void confirm()}
          >
            {busy ? "Recortando…" : "Usar"}
          </button>
        </div>
      </section>
    </div>
  );
}
