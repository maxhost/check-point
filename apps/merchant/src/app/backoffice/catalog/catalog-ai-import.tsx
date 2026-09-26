"use client";

import { useEffect, useState } from "react";
import { Page, Spark } from "iconoir-react";
import { StaffFormModal } from "../staff/staff-form-modal";
import { CatalogAiImportPicker } from "./catalog-ai-import-picker";
import { CatalogAiImportResult } from "./catalog-ai-import-result";
import { statusCopy } from "./catalog-ai-import-api";
import {
  isProcessing,
  processingMessage,
  PROCESSING_MESSAGE_INTERVAL_MS,
} from "./catalog-ai-import-state";
import { useCatalogImport } from "./use-catalog-import";

/**
 * LA CARGA INTELIGENTE DE CATALOGO (spec 0091 / ADR 0084).
 *
 * El merchant sube y **listo**: el servidor lee el menu y escribe el catalogo en la misma
 * pasada. Esta pantalla ya no revisa nada —no hay borrador, ni casillas, ni un boton de
 * aceptar— porque cuando hay algo para mostrar el catalogo YA esta escrito. Lo que quedo
 * dudoso se corrige en el catalogo, que es donde se corrige cualquier producto.
 *
 * Mientras se sube o se analiza el modal NO se cierra (spec 0093): solo queda «Cancelar
 * importación», y un mensaje rotativo muestra que se esta trabajando. Si el poll falla, el
 * error vuelve a habilitar el cierre para que nadie quede encerrado. `GET
 * /api/catalog/imports` devuelve el ULTIMO import, terminal incluido; al abrir, un `accepted`
 * se descarta y vuelve la eleccion de archivos (enmienda del owner a la 0093). El resumen se
 * ve solo cuando el poll presencia el final con el modal abierto.
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
    cancelling,
    error,
    result,
    choose,
    analyze,
    cancel,
    restart,
  } = useCatalogImport({ open, onClose, onAccepted });

  const processing = isProcessing({ status: activeImport?.status, busy });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open || !processing) return;
    setTick(0);
    const timer = window.setInterval(
      () => setTick((current) => current + 1),
      PROCESSING_MESSAGE_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [open, processing]);

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
      dismissible={!processing || error !== null}
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
            <div
              className={`catalog-ai-result-head${processing ? " is-processing" : ""}`}
            >
              {processing ? (
                <Spark aria-hidden="true" />
              ) : (
                <Page aria-hidden="true" />
              )}
              <div>
                <strong>
                  {processing
                    ? "Procesando tu menú"
                    : statusCopy(activeImport.status)}
                </strong>
                {processing ? (
                  // La `key` atada al tick remonta el `<p>` en cada cambio para que la animacion de
                  // entrada corra de nuevo (spec 0094). El `aria-live` va en el contenedor,
                  // que no se remonta, asi cada mensaje se anuncia una sola vez.
                  <div aria-live="polite">
                    <p key={tick} className="catalog-ai-processing-message">
                      {processingMessage(tick)}
                    </p>
                    <span className="catalog-ai-progress" aria-hidden="true" />
                  </div>
                ) : (
                  <p>
                    {activeImport.error?.message ??
                      "Los archivos elegidos ya no están en este dispositivo."}
                  </p>
                )}
              </div>
            </div>
            {/* Mientras se suben los archivos no se ofrece: cancelar ahi competiria con el
                `analyze()` en vuelo. Aparece cuando el analisis ya esta en el proveedor. */}
            {!busy && (
              <div className="catalog-editor-actions is-single">
                <button
                  className="button alt"
                  type="button"
                  disabled={cancelling}
                  onClick={() => void cancel()}
                >
                  {cancelling ? "Cancelando…" : "Cancelar importación"}
                </button>
              </div>
            )}
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
