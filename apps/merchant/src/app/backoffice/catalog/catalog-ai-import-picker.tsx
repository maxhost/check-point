"use client";

import { useRef, useState } from "react";
import { Camera, MediaImage, Page } from "iconoir-react";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  PDF_CONTENT_TYPE,
} from "../../../lib/image-formats";
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
  onAnalyze,
  onCancel,
}: {
  files: File[];
  busy: boolean;
  onChoose: (next: File[]) => void;
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
        onClick={() => fileRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          onChoose(Array.from(event.dataTransfer.files));
        }}
      >
        <span>
          <MediaImage aria-hidden="true" />
        </span>
        <strong>
          {files.length
            ? files.map((file) => file.name).join(", ")
            : "Subí tu menú o lista de precios"}
        </strong>
        <small>
          Arrastrá y soltá acá varias imágenes o un único PDF, o hacé clic para
          buscarlos. El servidor validará los límites vigentes.
        </small>
      </button>
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        multiple
        accept={`${ACCEPTED_IMAGE_ACCEPT_ATTR},${PDF_CONTENT_TYPE},.pdf`}
        onChange={(event) => onChoose(Array.from(event.target.files ?? []))}
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
            if (file)
              onChoose([
                ...files.filter(
                  (selected) => selected.type !== PDF_CONTENT_TYPE,
                ),
                file,
              ]);
            event.target.value = "";
          }}
        />
      )}
      <div className="catalog-ai-source-actions">
        {isTouch && (
          <button
            className="button alt"
            type="button"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera aria-hidden="true" /> Tomar foto
          </button>
        )}
        <button
          className="button alt"
          type="button"
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
          Agregá al menos una foto para habilitar el análisis. Los PDF se
          analizan automáticamente.
        </p>
      )}
    </>
  );
}
