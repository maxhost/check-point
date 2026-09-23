import type { CatalogImportStatus } from "../schema/catalog-import";

export type { CatalogImportStatus };

/**
 * Spec 0090 §6 — EL ERROR DE ESTA FEATURE, con `code` estable.
 *
 * Nace en vez de extender `CatalogError` porque `catalogError` (`api/catalog/_auth.ts:71-77`)
 * devuelve **`{error}` pelado** y las seis rutas que ya lo usan no se tocan. La forma del
 * contrato es `{ error, code }` y, solo en el 429, `retryAfterSeconds`.
 */
export class CatalogImportError extends Error {
  constructor(
    readonly status: number,
    readonly code: CatalogImportErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "CatalogImportError";
  }
}

/** La lista CERRADA de `code` de `specs/0090-contratos-de-api.md`. Un `code` que no esta
 * aca no existe: el contrato es lo que la pantalla programa. */
export const CATALOG_IMPORT_ERROR_CODES = [
  "invalid_import_files",
  "catalog_import_too_large",
  "catalog_import_in_progress",
  "catalog_import_rate_limited",
  "catalog_import_not_found",
  "catalog_import_state",
  "catalog_import_already_accepted",
  "unsupported_catalog_file",
  "catalog_pdf_encrypted",
  "catalog_page_limit",
  "provider_unavailable",
] as const;

export type CatalogImportErrorCode =
  (typeof CATALOG_IMPORT_ERROR_CODES)[number];

/** §5 — por que un item quedo AFUERA del catalogo. Va al resumen, para cargarlo a mano. */
export type DiscardReason = "unreadable_name" | "invalid_row";

export type DiscardedItem = { text: string; reason: DiscardReason };

export type ExtractedProduct = {
  sourceId: string;
  name: string;
  /**
   * §4 — EL FRAGMENTO IMPRESO DEL PRECIO, tal cual. El modelo ya **no** decide el estado del
   * precio: el servidor lo parsea con `parsePriceText` (`plan.ts`), que es lo que vuelve
   * testeable la decision. `null` = el menu no imprimia precio.
   */
  priceText: string | null;
};

export type ExtractedCategory = {
  sourceId: string;
  name: string;
  products: ExtractedProduct[];
};

export type ProviderExtraction = {
  categories: ExtractedCategory[];
  /** Lo ilegible, que NO entra al catalogo y se lista en el resumen (§5). */
  discarded: DiscardedItem[];
  warnings: string[];
  usage: { inputTokens: number | null; outputTokens: number | null };
  providerRequestId: string | null;
};

/** Una pagina ya normalizada, lista para el proveedor. */
export type CatalogExtractionPage = {
  /** JPEG normalizado (imagenes) o los bytes del PDF (una sola entrada). */
  bytes: Buffer;
  contentType: string;
  position: number;
};

export type CatalogExtractionInput = {
  importId: string;
  sourceKind: "pdf" | "images";
  pages: CatalogExtractionPage[];
};

export type StartResult =
  | { kind: "completed"; extraction: ProviderExtraction }
  | { kind: "deferred"; jobId: string };

export type PollResult =
  | { status: "pending" }
  | { status: "done"; extraction: ProviderExtraction }
  | { status: "failed"; code: string };

export interface CatalogExtractionProvider {
  readonly id: string;
  readonly model: string;
  /** Submitea. El adaptador decide si contesta ya o delega. */
  start(input: CatalogExtractionInput): Promise<StartResult>;
  /** Solo los diferidos. `pending` es una respuesta valida, no un error. */
  poll?(jobId: string): Promise<PollResult>;
  /** Solo los diferidos. Devuelve el jobId si la firma es valida; `null` si no. */
  verifyCallback?(headers: Headers, rawBody: string): { jobId: string } | null;
}

/**
 * §9 — EL RESUMEN de una importacion, persistido en `accepted_summary` y servido por el
 * `GET`. Es lo unico que la pantalla necesita para contar el resultado.
 */
export type ImportResult = {
  categoriesCreated: number;
  categoriesReused: number;
  productsCreated: number;
  productsSkipped: number;
  productsWithoutPrice: number;
  /** El total de descartes; `discarded` lista como maximo los primeros 50. */
  discardedCount: number;
  discarded: DiscardedItem[];
};

/** Lo que el `GET` devuelve. **Allow-list cerrada** (§6): ni `objectKey`, ni `providerJobId`,
 * ni `providerRequestId`, ni tokens, ni costo, ni respuesta cruda. */
export type CatalogImportDTO = {
  id: string;
  status: CatalogImportStatus;
  sourceKind: "pdf" | "images";
  fileCount: number;
  pageCount: number | null;
  expiresAt: string;
  /** Un objeto **solo** en `accepted`; en cualquier otro estado es `null` (§9). */
  result: ImportResult | null;
  error: { code: string; message: string } | null;
};

export type UploadTicket = {
  fileId: string;
  url: string;
  method: "PUT";
  headers: { "content-type": string };
};
