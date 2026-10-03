"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, MediaImage, Page, Xmark } from "iconoir-react";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  PDF_CONTENT_TYPE,
} from "@mi-pasaporte/domain/lib/image-formats";
import { useIsTouch } from "./use-is-touch";

/**
 * LA ELECCION DE ARCHIVOS. Un PDF **se analiza solo** al elegirlo (no hay boton), porque
 * mezclarlo con imagenes no esta permitido y no queda nada mas que decidir; con imagenes el
 * boton espera a que el merchant termine de agregarlas.
 */
export function CatalogAiImportPicker({
  files,
  busy,
  onChoose,
  onRemove,
  onAnalyze,
  onCancel,
}: {
  files: File[];
  busy: boolean;
  onChoose: (next: File[]) => void;
  onRemove: (index: number) => void;
  onAnalyze: () => void;
  onCancel: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const isTouch = useIsTouch();
  const hasSelectedPdf = files.some((file) => file.type === PDF_CONTENT_TYPE);

  return (
    <>
      <button
        className={`catalog-dropzone${isDragging ? " is-dragging" : ""}`}
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = busy ? "none" : "copy";
          if (!busy) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!busy) onChoose(Array.from(event.dataTransfer.files));
        }}
      >
        <span>
          <MediaImage aria-hidden="true" />
        </span>
        <strong>Sube tu menú o lista de precios</strong>
        <small>
          Arrastra y suelta aquí varias imágenes o un único PDF, o haz clic para
          buscarlos. El servidor validará los límites vigentes.
        </small>
      </button>
      {files.length > 0 && (
        <ul
          className="catalog-ai-file-grid"
          aria-label="Archivos seleccionados"
        >
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`}>
              {file.type === PDF_CONTENT_TYPE ? (
                <CatalogPdfTile name={file.name} />
              ) : (
                <CatalogImageTile
                  file={file}
                  busy={busy}
                  onRemove={() => onRemove(index)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        multiple
        accept={`${ACCEPTED_IMAGE_ACCEPT_ATTR},${PDF_CONTENT_TYPE},.pdf`}
        onChange={(event) => {
          onChoose(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {isTouch && (
        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onChoose([file]);
            event.target.value = "";
          }}
        />
      )}
      <div className="catalog-ai-source-actions">
        {isTouch && (
          <button
            className="button alt"
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera aria-hidden="true" /> Tomar foto
          </button>
        )}
        <button
          className="button alt"
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Page aria-hidden="true" /> Buscar archivos
        </button>
      </div>
      <div className="catalog-editor-actions">
        <button
          className="button alt"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </button>
        {!hasSelectedPdf && (
          <button
            className="button"
            data-tour="catalog-import-analyze"
            type="button"
            disabled={!files.length || busy}
            aria-describedby={files.length ? undefined : "catalog-analyze-help"}
            onClick={onAnalyze}
          >
            {busy ? "Subiendo…" : "Analizar catálogo"}
          </button>
        )}
      </div>
      {!files.length && (
        <p className="field-help" id="catalog-analyze-help">
          Agrega al menos una foto para habilitar el análisis. Los PDF se
          analizan automáticamente.
        </p>
      )}
    </>
  );
}

function CatalogImageTile({
  file,
  busy,
  onRemove,
}: {
  file: File;
  busy: boolean;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    setFailed(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="catalog-ai-file-tile">
      {preview?.file === file && !failed ? (
        <img
          className="catalog-ai-file-image"
          src={preview.url}
          alt={`Vista previa de ${file.name}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <MediaImage className="catalog-ai-file-fallback" aria-hidden="true" />
      )}
      <span className="catalog-ai-file-name" title={file.name}>
        {file.name}
      </span>
      <button
        className="catalog-ai-file-remove"
        type="button"
        disabled={busy}
        aria-label={`Quitar ${file.name}`}
        onClick={onRemove}
      >
        <Xmark aria-hidden="true" />
      </button>
    </div>
  );
}

export function CatalogPdfTile({ name }: { name?: string | null }) {
  return (
    <div className="catalog-ai-file-tile catalog-ai-file-pdf">
      <Page aria-hidden="true" />
      <strong>PDF</strong>
      {name && (
        <span className="catalog-ai-file-name" title={name}>
          {name}
        </span>
      )}
    </div>
  );
}
