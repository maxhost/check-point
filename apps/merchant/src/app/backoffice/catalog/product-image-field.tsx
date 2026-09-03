"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ACCEPTED_IMAGE_ACCEPT_ATTR } from "../../../lib/image-formats";
import type { CatalogImage } from "./use-catalog-image";
import { useIsTouch } from "./use-is-touch";
import { StockPicker } from "./stock-picker";

// Deferred on purpose: `react-easy-crop` must not ride in the initial bundle of the
// catalog page (ADR 0041 §3). `ssr: false` because the cropper is canvas/DOM-only.
const ImageCropper = dynamic(() => import("../../components/image-cropper"), {
  ssr: false,
});

/**
 * The image half of the product editor: own upload (with the 1:1 crop), stock library pick,
 * preview, attribution and removal. Split out of `product-editor.tsx` so both files stay
 * under the size limit once the cropper was added.
 */
export function ProductImageField({
  image,
  name,
  onError,
}: {
  image: CatalogImage;
  name: string;
  onError: (message: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  // Touch devices get the native camera/gallery chooser; desktop stays on the shared
  // allow-list (a narrow hardcoded list here rejected Android/iPhone photos three times).
  const isTouch = useIsTouch();
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <label>
        Imagen (opcional)
        <input
          ref={fileInput}
          type="file"
          accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}
          onChange={(event) => {
            void image.choose(event.target.files?.[0], onError);
          }}
        />
      </label>
      {isTouch && (
        <p className="field-help">
          Podés tomar una foto o elegir una de tu galería.
        </p>
      )}
      <div className="stock-or">o</div>
      <button
        type="button"
        className="small-button stock-library-button"
        onClick={() => setShowPicker(true)}
      >
        {image.visible
          ? "Elegir otra imagen de biblioteca"
          : "Elegir de biblioteca"}
      </button>
      {image.visible && (
        <div className="catalog-image-row">
          <img
            className="catalog-image-preview"
            src={image.visible}
            alt={`Imagen de ${name || "producto"}`}
          />
          <button
            type="button"
            className="small-button"
            onClick={() => {
              image.remove();
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            Quitar
          </button>
        </div>
      )}
      {image.credit?.author && (
        <p className="field-help catalog-credit">
          Foto de{" "}
          <a
            href={image.credit.sourceUrl ?? "https://www.pexels.com"}
            target="_blank"
            rel="noreferrer"
          >
            Pexels.com
          </a>{" "}
          · Autor:{" "}
          <a
            href={image.credit.authorUrl ?? "https://www.pexels.com"}
            target="_blank"
            rel="noreferrer"
          >
            {image.credit.author}
          </a>
        </p>
      )}
      {showPicker && (
        <StockPicker
          onApply={(provider, photo) => {
            image.chooseStock(provider, photo);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          onError={onError}
        />
      )}
      {image.pending && (
        <ImageCropper
          file={image.pending}
          surface="catalog"
          onDone={image.applyCrop}
          onCancel={() => {
            image.cancelCrop();
            if (fileInput.current) fileInput.current.value = "";
          }}
        />
      )}
    </>
  );
}
