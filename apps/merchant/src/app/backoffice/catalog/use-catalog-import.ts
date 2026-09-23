"use client";

import { useEffect, useRef, useState } from "react";
import { PDF_CONTENT_TYPE } from "../../../lib/image-formats";
import {
  CatalogImportRequestError,
  debug,
  debugError,
  importSummary,
  json,
  successful,
  type CatalogImport,
  type ImportResult,
  type Upload,
} from "./catalog-ai-import-api";

/**
 * TODA la conversacion con `/api/catalog/imports/*` (spec 0091 / ADR 0084), para que el
 * componente sea solo pantalla.
 *
 * No hay borrador ni aceptacion: el analisis termina con el catalogo **ya escrito** y el
 * import en `accepted` con su `result`. Lo unico que hace esta capa es mirar el estado,
 * poleando mientras el proveedor trabaja.
 */
export function useCatalogImport({
  open,
  onClose,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  onAccepted?: () => void | Promise<void>;
}) {
  const [activeImport, setActiveImport] = useState<CatalogImport | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const pollGenerationRef = useRef(0);
  /** El aviso al catalogo sale UNA vez por import, no una por respuesta del poll. */
  const notifiedRef = useRef<string | null>(null);

  function land(next: CatalogImport | null) {
    setActiveImport(next);
    if (next?.status === "accepted" && next.result) {
      setResult(next.result);
      if (notifiedRef.current !== next.id) {
        notifiedRef.current = next.id;
        void onAccepted?.();
      }
    }
  }

  useEffect(() => {
    if (!open) return;
    let current = true;
    debug("modal:open — consultando ultimo import");
    setLoading(true);
    setError(null);
    setResult(null);
    void fetch("/api/catalog/imports")
      .then((response) =>
        json<{ import: CatalogImport | null }>(
          response,
          "No pudimos consultar la importación.",
        ),
      )
      .then(({ import: found }) => {
        debug("last-import:response", importSummary(found));
        if (current) land(found);
      })
      .catch((reason: unknown) => {
        debugError("last-import:error", reason);
        if (current)
          setError(
            reason instanceof Error
              ? reason.message
              : "No pudimos consultar la importación.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      !activeImport ||
      (activeImport.status !== "queued" && activeImport.status !== "analyzing")
    )
      return;
    const id = activeImport.id;
    const generation = ++pollGenerationRef.current;
    let current = true;
    debug("poll:start", { id, status: activeImport.status, intervalMs: 3000 });
    const timer = window.setInterval(() => {
      debug("poll:request", { id });
      void fetch(`/api/catalog/imports/${id}`)
        .then((response) =>
          json<{ import: CatalogImport }>(
            response,
            "No pudimos actualizar el estado.",
          ),
        )
        .then(({ import: next }) => {
          if (!current || generation !== pollGenerationRef.current) return;
          debug("poll:response", importSummary(next));
          land(next);
        })
        .catch((reason: unknown) => {
          if (!current || generation !== pollGenerationRef.current) return;
          debugError("poll:error", reason);
          setError(
            reason instanceof Error
              ? reason.message
              : "No pudimos actualizar el estado.",
          );
        });
    }, 3000);
    return () => {
      current = false;
      debug("poll:stop", { id, status: activeImport.status });
      window.clearInterval(timer);
    };
  }, [open, activeImport?.id, activeImport?.status]);

  async function putFiles(
    importId: string,
    uploads: Upload[],
    selected: File[],
  ) {
    for (const [index, upload] of uploads.entries()) {
      debug("upload:put", { importId, fileId: upload.fileId });
      const response = await fetch(upload.url, {
        method: upload.method,
        headers: upload.headers,
        body: selected[index],
      });
      if (!response.ok)
        throw new Error("No pudimos subir uno de los archivos.");
    }
  }

  async function analyze(selected = files) {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    debug("reserve:start", { fileCount: selected.length });
    try {
      const reserved = await json<{ import: CatalogImport; uploads: Upload[] }>(
        await fetch("/api/catalog/imports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            files: selected.map((file) => ({
              name: file.name,
              contentType: file.type,
              byteSize: file.size,
            })),
          }),
        }),
        "No pudimos preparar la importación.",
      );
      debug("reserve:response", importSummary(reserved.import));
      setActiveImport(reserved.import);
      await putFiles(reserved.import.id, reserved.uploads, selected);
      debug("analyze:start", { importId: reserved.import.id });
      const analyzed = await json<{ import: CatalogImport }>(
        await fetch(`/api/catalog/imports/${reserved.import.id}/analyze`, {
          method: "POST",
        }),
        "No pudimos analizar el catálogo.",
      );
      debug("analyze:response", importSummary(analyzed.import));
      land(analyzed.import);
      setFiles([]);
    } catch (reason) {
      debugError("analyze:error", reason);
      // Ya habia uno en vuelo: se retoma en vez de perderlo (el analisis esta pago).
      if (
        reason instanceof CatalogImportRequestError &&
        reason.code === "catalog_import_in_progress"
      ) {
        try {
          const resumed = await json<{ import: CatalogImport | null }>(
            await fetch("/api/catalog/imports"),
            "No pudimos retomar la importación en curso.",
          );
          land(resumed.import);
          setFiles([]);
        } catch (nested) {
          debugError("resume:error", nested);
          setError(
            nested instanceof Error
              ? nested.message
              : "No pudimos retomar la importación en curso.",
          );
        }
        return;
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos analizar el catálogo.",
      );
    } finally {
      setBusy(false);
    }
  }

  function choose(next: File[]) {
    if (!next.length) return;
    const containsPdf = next.some((file) => file.type === PDF_CONTENT_TYPE);
    if (
      (containsPdf && next.length !== 1) ||
      (containsPdf && next.some((file) => file.type !== PDF_CONTENT_TYPE))
    ) {
      setFiles([]);
      setError("Elegí un PDF o solamente imágenes, sin mezclarlos.");
      return;
    }
    setFiles(next);
    setError(null);
    debug("files:selected", { count: next.length });
    if (containsPdf) void analyze(next);
  }

  async function cancel() {
    if (!activeImport) {
      onClose();
      return;
    }
    pollGenerationRef.current += 1;
    setBusy(true);
    setError(null);
    try {
      debug("cancel:start", { importId: activeImport.id });
      await successful(
        await fetch(`/api/catalog/imports/${activeImport.id}`, {
          method: "DELETE",
        }),
        "No pudimos cancelar la importación.",
      );
      debug("cancel:complete", { importId: activeImport.id });
      setActiveImport(null);
      setFiles([]);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos cancelar la importación.",
      );
    } finally {
      setBusy(false);
    }
  }

  return {
    activeImport,
    files,
    loading,
    busy,
    error,
    result,
    choose,
    analyze,
    cancel,
    restart: () => {
      setActiveImport(null);
      setError(null);
    },
  };
}
