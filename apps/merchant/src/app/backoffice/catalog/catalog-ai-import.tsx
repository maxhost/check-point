"use client";

import { Page, Spark } from "iconoir-react";
import { StaffFormModal } from "../staff/staff-form-modal";
import { CatalogAiImportPicker } from "./catalog-ai-import-picker";
import { CatalogAiImportResult } from "./catalog-ai-import-result";
import { statusCopy } from "./catalog-ai-import-api";
import { useCatalogImport } from "./use-catalog-import";

/**
 * LA CARGA INTELIGENTE DE CATALOGO (spec 0091 / ADR 0084).
 *
 * El merchant sube y **listo**: el servidor lee el menu y escribe el catalogo en la misma
 * pasada. Esta pantalla ya no revisa nada —no hay borrador, ni casillas, ni un boton de
 * aceptar— porque cuando hay algo para mostrar el catalogo YA esta escrito. Lo que quedo
 * dudoso se corrige en el catalogo, que es donde se corrige cualquier producto.
 *
 * El analisis es asincrono **a favor**: se puede cerrar el modal y volver. `GET
 * /api/catalog/imports` devuelve el ULTIMO import, terminal incluido, asi que un reload
 * despues de importar encuentra el resumen en vez de una pantalla en blanco.
 */
export function CatalogAiImport({
  open,
  onClose,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  onAccepted?: () => void | Promise<void>;
}) {
  const {
    activeImport,
    files,
    loading,
    busy,
    error,
    result,
    choose,
    analyze,
    cancel,
    restart,
  } = useCatalogImport({ open, onClose, onAccepted });

  const waiting =
    activeImport?.status === "queued" || activeImport?.status === "analyzing";
  const canStartAgain =
    activeImport?.status === "failed" ||
    activeImport?.status === "cancelled" ||
    activeImport?.status === "expired";

  return (
    <StaffFormModal
      open={open}
      eyebrow="Carga inteligente"
      title="Creá el catálogo desde un archivo"
      description="Subí fotos o un PDF de tu menú. Lo leemos y cargamos el catálogo por vos."
      onClose={onClose}
    >
      <div className="catalog-ai-modal">
        <p className="catalog-demo-note">
          <Spark aria-hidden="true" /> Tus archivos serán procesados con un
          proveedor externo de IA.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="field-help">Buscando una importación en curso…</p>
        ) : result ? (
          <CatalogAiImportResult result={result} onClose={onClose} />
        ) : canStartAgain && activeImport ? (
          <>
            <div className="catalog-ai-result-head">
              <Page aria-hidden="true" />
              <div>
                <strong>{statusCopy(activeImport.status)}</strong>
                <p>
                  {activeImport.error?.message ??
                    "Podés elegir los archivos nuevamente."}
                </p>
              </div>
            </div>
            <div className="catalog-editor-actions">
              <button className="button alt" type="button" onClick={onClose}>
                Cerrar
              </button>
              <button className="button" type="button" onClick={restart}>
                Empezar de nuevo
              </button>
            </div>
          </>
        ) : activeImport ? (
          <>
            <div className="catalog-ai-result-head">
              {waiting ? (
                <Spark aria-hidden="true" />
              ) : (
                <Page aria-hidden="true" />
              )}
              <div>
                <strong>{statusCopy(activeImport.status)}</strong>
                <p>
                  {waiting
                    ? "Podés cerrar esta pantalla y volver más tarde: te avisamos por email cuando esté."
                    : (activeImport.error?.message ??
                      "Los archivos elegidos ya no están en este dispositivo.")}
                </p>
              </div>
            </div>
            <div className="catalog-editor-actions">
              <button
                className="button alt"
                type="button"
                disabled={busy}
                onClick={() => void cancel()}
              >
                {busy ? "Cancelando…" : "Cancelar importación"}
              </button>
              <button className="button" type="button" onClick={onClose}>
                Cerrar y continuar después
              </button>
            </div>
          </>
        ) : (
          <CatalogAiImportPicker
            files={files}
            busy={busy}
            onChoose={choose}
            onAnalyze={() => void analyze()}
            onCancel={() => void cancel()}
          />
        )}
      </div>
    </StaffFormModal>
  );
}
