import type { CatalogImportStatus } from "@mi-pasaporte/db/schema/catalog-import";
import type { CatalogImportDTO, ImportResult } from "./types";
import type { ImportRow } from "./core";

/**
 * Spec 0090 §6 — EL DTO, ALLOW-LIST CERRADA.
 *
 * Se construye campo por campo **a proposito**: un `...row` con un `delete` de por medio
 * filtra cada columna que la tabla gane en el futuro. No viajan —ni van a viajar— la clave de
 * R2, el `provider_job_id`, el `provider_request_id`, los tokens, el costo ni la respuesta
 * cruda del modelo.
 *
 * Spec 0147 — `sourceFileName` es obligatorio para que el typecheck obligue a cada llamador a
 * resolverlo (`importSourceFileName`); para imagenes es `null` aunque se pase un nombre.
 */
export function toImportDTO(
  row: ImportRow,
  sourceFileName: string | null,
): CatalogImportDTO {
  return {
    id: row.id,
    status: row.status as CatalogImportStatus,
    sourceKind: row.sourceKind === "pdf" ? "pdf" : "images",
    fileCount: row.fileCount,
    pageCount: row.pageCount,
    expiresAt: row.expiresAt.toISOString(),
    // §9 — `result` es un objeto **solo** en `accepted`. En cualquier otro estado es `null`,
    // y la extraccion cruda que vive en la columna `draft` **nunca** cruza al cliente.
    result:
      row.status === "accepted"
        ? ((row.acceptedSummary as ImportResult | null) ?? null)
        : null,
    error:
      row.status === "failed"
        ? {
            code: row.failureCode ?? "catalog_import_failed",
            message:
              row.failureDetail ??
              "No pudimos analizar el menú. Prueba de nuevo.",
          }
        : null,
    sourceFileName: row.sourceKind === "pdf" ? sourceFileName : null,
  };
}
