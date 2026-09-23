/**
 * Cliente y tipos de `/api/catalog/imports/*`, escritos contra el contrato de
 * `docs/specs/0090-contratos-de-api.md` (spec 0091 / ADR 0084).
 *
 * **La importacion escribe el catalogo sola.** No hay borrador, ni revision, ni aceptacion:
 * el DTO trae `result` cuando el import quedo `accepted`, y `result` es `null` en cualquier
 * otro estado. `PUT /{id}/draft` y `POST /{id}/accept` **ya no existen**.
 */

export type ImportStatus =
  | "pending_upload"
  | "queued"
  | "analyzing"
  | "accepted"
  | "failed"
  | "cancelled"
  | "expired";

/** Por que un item no entro al catalogo. La lista viene recortada por el servidor. */
export type DiscardedItem = {
  text: string;
  reason: "unreadable_name" | "invalid_row";
};

/** El resumen de lo que la importacion escribio. Solo existe en `accepted`. */
export type ImportResult = {
  categoriesCreated: number;
  categoriesReused: number;
  productsCreated: number;
  productsSkipped: number;
  productsWithoutPrice: number;
  discardedCount: number;
  discarded: DiscardedItem[];
};

export type CatalogImport = {
  id: string;
  status: ImportStatus;
  sourceKind?: "images" | "pdf";
  fileCount?: number;
  pageCount?: number;
  expiresAt: string;
  result?: ImportResult | null;
  error?: { code: string; message: string } | null;
};

export type Upload = {
  fileId: string;
  url: string;
  method: "PUT";
  headers: { "content-type": string };
};

type ApiError = { error?: string; code?: string; retryAfterSeconds?: number };

const DEBUG_PREFIX = "[catalog-ai-import]";

export function debug(event: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(DEBUG_PREFIX, event, JSON.stringify(details ?? {}));
}

export function debugError(event: string, reason: unknown) {
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

export function importSummary(value: CatalogImport | null) {
  if (!value) return { found: false };
  return {
    found: true,
    id: value.id,
    status: value.status,
    sourceKind: value.sourceKind,
    fileCount: value.fileCount,
    pageCount: value.pageCount,
    expiresAt: value.expiresAt,
    hasResult: Boolean(value.result),
    error: value.error,
  };
}

export class CatalogImportRequestError extends Error {
  code?: string;

  constructor(payload: ApiError | null, fallback: string) {
    const retry = payload?.retryAfterSeconds;
    super(
      `${payload?.error ?? fallback}${typeof retry === "number" ? ` Podés intentar nuevamente en ${retry} segundos.` : ""}`,
    );
    this.code = payload?.code;
  }
}

export async function json<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & ApiError)
    | null;
  if (!response.ok) throw new CatalogImportRequestError(payload, fallback);
  if (!payload) throw new Error(fallback);
  return payload;
}

export async function successful(
  response: Response,
  fallback: string,
): Promise<void> {
  if (response.ok) return;
  const payload = (await response.json().catch(() => null)) as ApiError | null;
  throw new CatalogImportRequestError(payload, fallback);
}

/**
 * El copy por estado. **`ready` ya no existe** (spec 0091 §1): cuando el analisis termina, el
 * catalogo YA esta escrito y el import queda en `accepted`.
 */
export function statusCopy(status: ImportStatus) {
  if (status === "pending_upload") return "La carga quedó pendiente.";
  if (status === "queued") return "Tu catálogo está en cola.";
  if (status === "analyzing")
    return "Estamos leyendo tu menú y cargando el catálogo.";
  if (status === "failed") return "No pudimos analizar el catálogo.";
  if (status === "cancelled") return "Cancelaste la importación.";
  if (status === "expired") return "La importación venció.";
  return "Preparando la importación.";
}
