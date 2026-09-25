import type { CatalogImport, ImportStatus } from "./catalog-ai-import-api";

/**
 * LAS TRES DECISIONES DEL MODAL DE IMPORTACION (spec 0093), puras para que tengan oraculo sin
 * DOM (vitest corre en `node`).
 *
 * - `isProcessing`: cuando rotan los mensajes y el modal NO se cierra.
 * - `processingMessage`: el texto rotativo, para que se vea que se esta trabajando y no que se
 *   colgo. Ninguno promete un aviso por email: el ADR 0085 lo borro.
 * - `importToShow`: un import `accepted` nunca se vuelve a pintar al abrir, ni tras un reload
 *   (enmienda del owner): el modal vuelve a la eleccion de archivos.
 */

/** Se esta subiendo (`pending_upload` con `busy`) o el proveedor esta leyendo el menu. */
export function isProcessing({
  status,
  busy,
}: {
  status: ImportStatus | null | undefined;
  busy: boolean;
}): boolean {
  if (status === "queued" || status === "analyzing") return true;
  return status === "pending_upload" && busy;
}

export const PROCESSING_MESSAGES = [
  "Esperá, estamos procesando tu menú…",
  "Estamos leyendo los productos y sus precios…",
  "Ordenando las categorías de tu catálogo…",
  "Ya casi: estamos cargando los productos…",
] as const;

/** Cada cuanto avanza el mensaje rotativo. */
export const PROCESSING_MESSAGE_INTERVAL_MS = 3000;

export function processingMessage(tick: number): string {
  return PROCESSING_MESSAGES[tick % PROCESSING_MESSAGES.length];
}

/**
 * Lo que devuelve el `GET /api/catalog/imports` al abrir, salvo un `accepted`: ese se omite y el
 * modal vuelve a la eleccion de archivos. El resumen solo se ve cuando el poll presencia la
 * transicion con el modal abierto. Los terminales `failed`/`cancelled`/`expired` SI se muestran:
 * traen su mensaje y el «Empezar de nuevo».
 */
export function importToShow(
  found: CatalogImport | null,
): CatalogImport | null {
  if (found?.status === "accepted") return null;
  return found;
}
