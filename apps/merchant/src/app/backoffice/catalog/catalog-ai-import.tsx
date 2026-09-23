"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, MediaImage, Page, Spark } from "iconoir-react";
import {
  ACCEPTED_IMAGE_ACCEPT_ATTR,
  PDF_CONTENT_TYPE,
} from "../../../lib/image-formats";
import { StaffFormModal } from "../staff/staff-form-modal";

type ImportStatus =
  | "pending_upload"
  | "queued"
  | "analyzing"
  | "ready"
  | "accepted"
  | "failed"
  | "cancelled"
  | "expired";

type ProductDraft = {
  draftId: string;
  name: string;
  unitPrice: string | null;
  priceStatus: "detected" | "ambiguous";
  sourceText: string;
  include: boolean;
  duplicateCandidate: { productId: string; name: string } | null;
};

type CategoryDraft = {
  draftId: string;
  name: string;
  resolution:
    | { kind: "create" }
    | { kind: "use_existing"; categoryId: string }
    | { kind: "uncategorized" }
    | { kind: "discard" };
  duplicateCandidate: { categoryId: string; name: string } | null;
  products: ProductDraft[];
};

type CatalogDraft = {
  version: number;
  categories: CategoryDraft[];
  warnings: string[];
};

type CatalogImport = {
  id: string;
  status: ImportStatus;
  sourceKind?: "images" | "pdf";
  fileCount?: number;
  pageCount?: number;
  expiresAt: string;
  draft?: CatalogDraft | null;
  error?: { code: string; message: string } | null;
};

type Upload = {
  fileId: string;
  url: string;
  method: "PUT";
  headers: { "content-type": string };
};

type ApiError = { error?: string; code?: string; retryAfterSeconds?: number };

const DEBUG_PREFIX = "[catalog-ai-import]";

function debug(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(DEBUG_PREFIX, event, JSON.stringify(details ?? {}));
}

function debugError(event: string, reason: unknown) {
  if (process.env.NODE_ENV === "production") return;
  console.error(
    DEBUG_PREFIX,
    event,
    JSON.stringify({
      name: reason instanceof Error ? reason.name : typeof reason,
      message: reason instanceof Error ? reason.message : String(reason),
      code:
        reason instanceof CatalogImportRequestError ? reason.code : undefined,
    }),
  );
}

function importSummary(value: CatalogImport | null) {
  if (!value) return { found: false };
  return {
    found: true,
    id: value.id,
    status: value.status,
    sourceKind: value.sourceKind,
    fileCount: value.fileCount,
    pageCount: value.pageCount,
    expiresAt: value.expiresAt,
    hasDraft: Boolean(value.draft),
    error: value.error,
  };
}

class CatalogImportRequestError extends Error {
  code?: string;

  constructor(payload: ApiError | null, fallback: string) {
    const retry = payload?.retryAfterSeconds;
    super(
      `${payload?.error ?? fallback}${typeof retry === "number" ? ` Podés intentar nuevamente en ${retry} segundos.` : ""}`,
    );
    this.code = payload?.code;
  }
}

async function json<T>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & ApiError)
    | null;
  if (!response.ok) throw new CatalogImportRequestError(payload, fallback);
  if (!payload) throw new Error(fallback);
  return payload;
}

async function successful(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const payload = (await response.json().catch(() => null)) as ApiError | null;
  throw new CatalogImportRequestError(payload, fallback);
}

function statusCopy(status: ImportStatus) {
  if (status === "pending_upload") return "La carga quedó pendiente.";
  if (status === "queued") return "Tu catálogo está en cola.";
  if (status === "analyzing") return "Estamos analizando tu menú.";
  if (status === "failed") return "No pudimos analizar el catálogo.";
  return "Preparando la importación.";
}

export function CatalogAiImport({
  open,
  onClose,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  onAccepted?: () => void | Promise<void>;
}) {
  const [activeImport, setActiveImport] = useState<CatalogImport | null>(null);
  const [draft, setDraft] = useState<CatalogDraft | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    categoriesCreated: number;
    productsCreated: number;
    productsWithoutPrice: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    debug("modal:open — consultando import activo");
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
        debug("active-import:response", importSummary(found));
        if (!current) return;
        setActiveImport(found);
        setDraft(found?.draft ?? null);
      })
      .catch((reason: unknown) => {
        debugError("active-import:error", reason);
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
          debug("poll:response", importSummary(next));
          setActiveImport(next);
          setDraft(next.draft ?? null);
        })
        .catch((reason: unknown) => {
          debugError("poll:error", reason);
          setError(
            reason instanceof Error
              ? reason.message
              : "No pudimos actualizar el estado.",
          );
        });
    }, 3000);
    return () => {
      debug("poll:stop", { id, status: activeImport.status });
      window.clearInterval(timer);
    };
  }, [open, activeImport?.id, activeImport?.status]);

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
    debug("files:selected", {
      count: next.length,
      files: next.map((file) => ({ type: file.type, byteSize: file.size })),
    });
  }

  async function putFiles(
    importId: string,
    uploads: Upload[],
    selected: File[],
  ) {
    const filesById = new Map(
      uploads.map((upload, index) => [upload.fileId, selected[index]]),
    );
    const send = async (upload: Upload, position: number) => {
      const file = filesById.get(upload.fileId);
      if (!file)
        throw new Error("No pudimos relacionar un archivo con su carga.");
      debug("upload:start", {
        importId,
        fileId: upload.fileId,
        position,
        contentType: upload.headers["content-type"],
        byteSize: file.size,
      });
      const response = await fetch(upload.url, {
        method: "PUT",
        headers: { "content-type": upload.headers["content-type"] },
        body: file,
      });
      if (!response.ok)
        throw new Error("No pudimos cargar uno de los archivos.");
      debug("upload:complete", {
        importId,
        fileId: upload.fileId,
        position,
        httpStatus: response.status,
      });
    };

    try {
      for (const [index, upload] of uploads.entries())
        await send(upload, index);
    } catch (reason) {
      debugError("upload:error — solicitando nuevas firmas", reason);
      const renewed = await json<{ uploads: Upload[] }>(
        await fetch(`/api/catalog/imports/${importId}/uploads`, {
          method: "POST",
        }),
        "No pudimos reanudar la carga.",
      );
      debug("upload:resigned", {
        importId,
        remainingUploads: renewed.uploads.length,
      });
      for (const [index, upload] of renewed.uploads.entries())
        await send(upload, index);
    }
  }

  async function analyze() {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    debug("reserve:start", {
      fileCount: files.length,
      files: files.map((file) => ({ type: file.type, byteSize: file.size })),
    });
    try {
      const reserved = await json<{ import: CatalogImport; uploads: Upload[] }>(
        await fetch("/api/catalog/imports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            files: files.map((file) => ({
              name: file.name,
              contentType: file.type,
              byteSize: file.size,
            })),
          }),
        }),
        "No pudimos preparar la carga.",
      );
      debug("reserve:complete", {
        ...importSummary(reserved.import),
        uploadCount: reserved.uploads.length,
      });
      setActiveImport(reserved.import);
      await putFiles(reserved.import.id, reserved.uploads, files);
      debug("analyze:start", { importId: reserved.import.id });
      const analyzed = await json<{ import: CatalogImport }>(
        await fetch(`/api/catalog/imports/${reserved.import.id}/analyze`, {
          method: "POST",
        }),
        "No pudimos iniciar el análisis.",
      );
      debug("analyze:accepted", importSummary(analyzed.import));
      setActiveImport(analyzed.import);
      setDraft(analyzed.import.draft ?? null);
      setFiles([]);
    } catch (reason) {
      debugError("analyze-flow:error", reason);
      if (
        reason instanceof CatalogImportRequestError &&
        reason.code === "catalog_import_in_progress"
      ) {
        try {
          const resumed = await json<{ import: CatalogImport | null }>(
            await fetch("/api/catalog/imports"),
            "No pudimos retomar la importación en curso.",
          );
          debug("conflict:resumed", importSummary(resumed.import));
          setActiveImport(resumed.import);
          setDraft(resumed.import?.draft ?? null);
        } catch (resumeReason) {
          debugError("conflict:resume-error", resumeReason);
          setError(
            resumeReason instanceof Error
              ? resumeReason.message
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

  async function cancel() {
    if (!activeImport) {
      onClose();
      return;
    }
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
      setDraft(null);
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

  function updateCategory(categoryIndex: number, name: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            categories: current.categories.map((category, index) =>
              index === categoryIndex ? { ...category, name } : category,
            ),
          }
        : current,
    );
  }

  function updateProduct(
    categoryIndex: number,
    productIndex: number,
    change: Partial<ProductDraft>,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            categories: current.categories.map((category, index) =>
              index === categoryIndex
                ? {
                    ...category,
                    products: category.products.map(
                      (product, productPosition) =>
                        productPosition === productIndex
                          ? { ...product, ...change }
                          : product,
                    ),
                  }
                : category,
            ),
          }
        : current,
    );
  }

  async function accept() {
    if (!activeImport || !draft) return;
    setBusy(true);
    setError(null);
    try {
      await successful(
        await fetch(`/api/catalog/imports/${activeImport.id}/draft`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        }),
        "No pudimos guardar la revisión.",
      );
      const accepted = await json<{
        result: {
          importId: string;
          categoriesCreated: number;
          productsCreated: number;
          productsWithoutPrice: number;
        };
      }>(
        await fetch(`/api/catalog/imports/${activeImport.id}/accept`, {
          method: "POST",
        }),
        "No pudimos importar el catálogo.",
      );
      setResult(accepted.result);
      setActiveImport({ ...activeImport, status: "accepted" });
      await onAccepted?.();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos importar el catálogo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const ambiguousCount =
    draft?.categories.reduce(
      (total, category) =>
        total +
        category.products.filter(
          (product) => product.include && product.priceStatus === "ambiguous",
        ).length,
      0,
    ) ?? 0;
  const productCount =
    draft?.categories.reduce(
      (total, category) => total + category.products.length,
      0,
    ) ?? 0;
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
      description="Subí fotos o un PDF de tu menú. La IA preparará un borrador para que lo revises."
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
          <>
            <div className="catalog-ai-result-head">
              <CheckCircle aria-hidden="true" />
              <div>
                <strong>Catálogo importado</strong>
                <p>
                  {result.categoriesCreated} categorías y{" "}
                  {result.productsCreated} productos creados.
                </p>
              </div>
            </div>
            {result.productsWithoutPrice > 0 && (
              <p className="field-help">
                {result.productsWithoutPrice} productos quedaron sin precio.
                Podés completarlos cuando quieras.
              </p>
            )}
            <button className="button" type="button" onClick={onClose}>
              Cerrar
            </button>
          </>
        ) : draft && activeImport?.status === "ready" ? (
          <>
            <div className="catalog-ai-result-head">
              <CheckCircle aria-hidden="true" />
              <div>
                <strong>Borrador listo para revisar</strong>
                <p>
                  Encontramos {draft.categories.length} categorías y{" "}
                  {productCount} productos.
                </p>
              </div>
            </div>
            {draft.warnings.map((warning) => (
              <p className="catalog-demo-note" key={warning}>
                {warning}
              </p>
            ))}
            {ambiguousCount > 0 && (
              <p className="catalog-demo-note">
                {ambiguousCount} productos no tienen un precio confiable. Podés
                importarlos y completarlos después.
              </p>
            )}
            <div className="catalog-ai-preview">
              {draft.categories.map((category, categoryIndex) => (
                <section key={category.draftId}>
                  <label>
                    <span className="field-label">Categoría</span>
                    <input
                      value={category.name}
                      onChange={(event) =>
                        updateCategory(categoryIndex, event.target.value)
                      }
                    />
                  </label>
                  {category.duplicateCandidate && (
                    <small>
                      Posible duplicado: {category.duplicateCandidate.name}
                    </small>
                  )}
                  {category.products.map((product, productIndex) => (
                    <div className="catalog-ai-product" key={product.draftId}>
                      <input
                        aria-label={`Incluir ${product.name}`}
                        checked={product.include}
                        type="checkbox"
                        onChange={(event) =>
                          updateProduct(categoryIndex, productIndex, {
                            include: event.target.checked,
                          })
                        }
                      />
                      <input
                        aria-label="Nombre del producto"
                        value={product.name}
                        onChange={(event) =>
                          updateProduct(categoryIndex, productIndex, {
                            name: event.target.value,
                          })
                        }
                      />
                      <input
                        aria-label={`Precio de ${product.name}`}
                        inputMode="decimal"
                        placeholder="Sin precio"
                        value={product.unitPrice ?? ""}
                        onChange={(event) => {
                          const unitPrice = event.target.value || null;
                          updateProduct(categoryIndex, productIndex, {
                            unitPrice,
                            priceStatus:
                              unitPrice === null ? "ambiguous" : "detected",
                          });
                        }}
                      />
                      {(product.priceStatus === "ambiguous" ||
                        product.duplicateCandidate) && (
                        <small>
                          {product.priceStatus === "ambiguous"
                            ? "Precio por confirmar"
                            : ""}
                          {product.priceStatus === "ambiguous" &&
                          product.duplicateCandidate
                            ? " · "
                            : ""}
                          {product.duplicateCandidate
                            ? `Posible duplicado: ${product.duplicateCandidate.name}`
                            : ""}
                        </small>
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </div>
            <div className="catalog-editor-actions">
              <button
                className="button alt"
                type="button"
                disabled={busy}
                onClick={() => void cancel()}
              >
                Cancelar importación
              </button>
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => void accept()}
              >
                {busy ? "Importando…" : "Importar borrador"}
              </button>
            </div>
          </>
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
              <button
                className="button"
                type="button"
                onClick={() => {
                  setActiveImport(null);
                  setDraft(null);
                  setError(null);
                }}
              >
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
                    ? "Podés cerrar esta pantalla y volver más tarde."
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
                Cancelar importación
              </button>
              <button className="button" type="button" onClick={onClose}>
                Cerrar y continuar después
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              className="catalog-dropzone"
              type="button"
              onClick={() => fileRef.current?.click()}
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
                Elegí varias imágenes, o un único PDF. El servidor validará los
                límites vigentes.
              </small>
            </button>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              multiple
              accept={`${ACCEPTED_IMAGE_ACCEPT_ATTR},${PDF_CONTENT_TYPE},.pdf`}
              onChange={(event) => choose(Array.from(event.target.files ?? []))}
            />
            <input
              ref={cameraRef}
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  choose([
                    ...files.filter(
                      (selected) => selected.type !== PDF_CONTENT_TYPE,
                    ),
                    file,
                  ]);
                event.target.value = "";
              }}
            />
            <div className="catalog-ai-source-actions">
              <button
                className="button alt"
                type="button"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera aria-hidden="true" /> Tomar foto
              </button>
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
                onClick={() => void cancel()}
              >
                Cancelar
              </button>
              <button
                className="button"
                type="button"
                disabled={!files.length || busy}
                onClick={() => void analyze()}
              >
                {busy ? "Subiendo…" : "Analizar catálogo"}
              </button>
            </div>
          </>
        )}
      </div>
    </StaffFormModal>
  );
}
