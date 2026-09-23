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
  "catalog_import_version",
  "catalog_import_already_accepted",
  "catalog_import_conflict",
  "unresolved_catalog_import",
  "invalid_catalog_draft",
  "unsupported_catalog_file",
  "catalog_pdf_encrypted",
  "catalog_page_limit",
  "provider_unavailable",
] as const;

export type CatalogImportErrorCode =
  (typeof CATALOG_IMPORT_ERROR_CODES)[number];

/** El precio: DOS estados y ninguno bloquea (ADR 0082 §9). `ambiguous` ⇒ `unitPrice: null`. */
export type PriceStatus = "detected" | "ambiguous";

export type ExtractedProduct = {
  sourceId: string;
  name: string;
  /** Decimal en STRING, como todo el dinero del repo (`numeric(12,2)`). `null` = sin precio. */
  unitPrice: string | null;
  priceStatus: PriceStatus;
  sourceText: string | null;
};

export type ExtractedCategory = {
  sourceId: string;
  name: string;
  products: ExtractedProduct[];
};

export type ProviderExtraction = {
  categories: ExtractedCategory[];
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

/** La resolucion de una categoria del borrador (§5). */
export type CategoryResolution =
  | { kind: "create" }
  | { kind: "use_existing"; categoryId: string }
  | { kind: "uncategorized" }
  | { kind: "discard" };

export type DuplicateCandidateCategory = {
  categoryId: string;
  name: string;
} | null;

export type DuplicateCandidateProduct = {
  productId: string;
  name: string;
} | null;

export type DraftProduct = {
  draftId: string;
  name: string;
  unitPrice: string | null;
  priceStatus: PriceStatus;
  sourceText: string | null;
  include: boolean;
  duplicateCandidate: DuplicateCandidateProduct;
};

export type DraftCategory = {
  draftId: string;
  name: string;
  resolution: CategoryResolution;
  duplicateCandidate: DuplicateCandidateCategory;
  products: DraftProduct[];
};

export type CatalogImportDraft = {
  version: number;
  categories: DraftCategory[];
  warnings: string[];
};

export type AcceptedSummary = {
  importId: string;
  categoriesCreated: number;
  productsCreated: number;
  productsWithoutPrice: number;
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
  draft: CatalogImportDraft | null;
  error: { code: string; message: string } | null;
};

export type UploadTicket = {
  fileId: string;
  url: string;
  method: "PUT";
  headers: { "content-type": string };
};
