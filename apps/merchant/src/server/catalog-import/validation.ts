import { ACCEPTED_IMAGE_CONTENT_TYPE_SET } from "../../lib/image-formats";
import { PDF_CONTENT_TYPE } from "../../lib/image-formats";
import { parseOptionalMoney } from "../catalog/validation";
import { CatalogError } from "../catalog/core";
import {
  CatalogImportError,
  type ExtractedCategory,
  type ExtractedProduct,
  type PriceStatus,
  type ProviderExtraction,
} from "./types";

/**
 * Spec 0090 §2 — LOS LIMITES DEL PRODUCTO. No se elevan porque un proveedor tolere mas.
 */
export const MAX_IMAGE_FILES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
export const MAX_DRAFT_PRODUCTS = 250;
/** Los del catalogo real (`catalog/validation.ts:111,152`). No nacen otros. */
export const MAX_PRODUCT_NAME = 120;
export const MAX_CATEGORY_NAME = 60;
export const MAX_WARNINGS = 20;
export const MAX_WARNING_LENGTH = 300;
export const MAX_SOURCE_TEXT_LENGTH = 200;
/** Lo que `analyze` lee de CADA objeto para sniffear bytes sin bajarse el archivo. */
export const SNIFF_BYTES = 4096;

export type ReservedFile = {
  name: string;
  contentType: string;
  byteSize: number;
};

export type ReservedFiles = {
  sourceKind: "pdf" | "images";
  files: ReservedFile[];
};

const invalid = (message: string) =>
  new CatalogImportError(400, "invalid_import_files", message);

/**
 * §2 — O **UN** PDF, O **SOLO** imagenes. Nunca mezcla, y esa es la regla que no se deduce.
 *
 * Lo que valida es lo **declarado**: cantidad, tope de bytes y tipo. La autoridad real sobre
 * el formato sigue siendo el sniff por bytes de `analyze` (§2: «la extension y el
 * `content-type` del cliente no son autoridad»), que corre despues de la subida.
 */
export function validateImportFiles(value: unknown): ReservedFiles {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("La solicitud no es válida.");
  }
  const raw = (value as Record<string, unknown>).files;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw invalid("Subí al menos un archivo.");
  }
  if (raw.length > MAX_IMAGE_FILES) {
    throw invalid(`Como máximo ${MAX_IMAGE_FILES} archivos.`);
  }
  const files = raw.map(parseReservedFile);
  const pdfCount = files.filter(
    (file) => file.contentType === PDF_CONTENT_TYPE,
  ).length;
  if (pdfCount > 0 && pdfCount !== files.length) {
    throw invalid("Subí un PDF o fotos, no una mezcla de los dos.");
  }
  if (pdfCount > 1) {
    throw invalid("Subí un solo PDF.");
  }
  if (pdfCount === 1) {
    if (files[0].byteSize > MAX_PDF_BYTES) {
      throw new CatalogImportError(
        413,
        "catalog_import_too_large",
        "El PDF puede pesar como máximo 20 MB.",
      );
    }
    return { sourceKind: "pdf", files };
  }
  for (const file of files) {
    if (!ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(file.contentType)) {
      throw invalid("Solo aceptamos PDF, JPEG, PNG, WebP o HEIC.");
    }
    if (file.byteSize > MAX_IMAGE_BYTES) {
      throw new CatalogImportError(
        413,
        "catalog_import_too_large",
        "Cada foto puede pesar como máximo 10 MB.",
      );
    }
  }
  const total = files.reduce((sum, file) => sum + file.byteSize, 0);
  if (total > MAX_IMAGES_TOTAL_BYTES) {
    throw new CatalogImportError(
      413,
      "catalog_import_too_large",
      "Las fotos pueden pesar como máximo 50 MB en total.",
    );
  }
  return { sourceKind: "images", files };
}

function parseReservedFile(value: unknown): ReservedFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("Hay un archivo inválido en la lista.");
  }
  const file = value as Record<string, unknown>;
  const contentType =
    typeof file.contentType === "string" ? file.contentType.trim() : "";
  if (
    contentType !== PDF_CONTENT_TYPE &&
    !ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(contentType)
  ) {
    throw invalid("Solo aceptamos PDF, JPEG, PNG, WebP o HEIC.");
  }
  const byteSize = file.byteSize;
  if (
    typeof byteSize !== "number" ||
    !Number.isInteger(byteSize) ||
    byteSize < 1
  ) {
    throw invalid("Hay un archivo sin tamaño válido.");
  }
  const name = sanitizeText(
    typeof file.name === "string" ? file.name : "",
    120,
  );
  return { name: name || "archivo", contentType, byteSize };
}

/**
 * §4 — SANEADO de todo texto que viene del modelo o del cliente: sin caracteres de control,
 * espacios colapsados, recortado al tope. El documento del merchant es **entrada no
 * confiable**: su texto es dato, nunca instruccion.
 */
export function sanitizeText(value: string, maxLength: number): string {
  // eslint-disable-next-line no-control-regex
  const withoutControl = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  return withoutControl.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** La normalizacion de duplicados, que es **la del indice real**
 * `core_product_category_name_unique` sobre `(business_id, lower(name))`. */
export function normalizeForDuplicate(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * §4 — LA SALIDA DEL PROVEEDOR SIEMPRE SE VALIDA CONTRA ESTE ESQUEMA CERRADO, aunque el
 * proveedor prometa JSON Schema. Lo no conforme se rechaza **antes de persistir**.
 */
export function validateProviderExtraction(value: unknown): ProviderExtraction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("extraction_not_an_object");
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.categories))
    throw new Error("extraction_no_categories");
  const seenCategoryIds = new Set<string>();
  const seenProductIds = new Set<string>();
  let productCount = 0;
  const categories: ExtractedCategory[] = raw.categories.map((entry) => {
    const category = requireObject(entry, "category");
    const sourceId = requireSourceId(category.sourceId, seenCategoryIds);
    const name = sanitizeText(requireString(category.name), MAX_CATEGORY_NAME);
    if (!name) throw new Error("extraction_empty_category_name");
    const rawProducts = category.products;
    if (!Array.isArray(rawProducts)) throw new Error("extraction_no_products");
    const products: ExtractedProduct[] = rawProducts.map((item) => {
      productCount += 1;
      if (productCount > MAX_DRAFT_PRODUCTS) {
        // §2: excederlo FALLA EXPLICITAMENTE, no trunca.
        throw new Error("extraction_too_many_products");
      }
      return parseExtractedProduct(item, seenProductIds);
    });
    return { sourceId, name, products };
  });
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings
        .slice(0, MAX_WARNINGS)
        .map((warning) => sanitizeText(String(warning), MAX_WARNING_LENGTH))
        .filter((warning) => warning.length > 0)
    : [];
  const usage = raw.usage as Record<string, unknown> | undefined;
  return {
    categories,
    warnings,
    usage: {
      inputTokens: optionalInteger(usage?.inputTokens),
      outputTokens: optionalInteger(usage?.outputTokens),
    },
    providerRequestId:
      typeof raw.providerRequestId === "string"
        ? sanitizeText(raw.providerRequestId, 120)
        : null,
  };
}

function parseExtractedProduct(
  value: unknown,
  seen: Set<string>,
): ExtractedProduct {
  const item = requireObject(value, "product");
  const sourceId = requireSourceId(item.sourceId, seen);
  const name = sanitizeText(requireString(item.name), MAX_PRODUCT_NAME);
  if (!name) throw new Error("extraction_empty_product_name");
  const priceStatus: PriceStatus =
    item.priceStatus === "detected" ? "detected" : "ambiguous";
  // **`ambiguous` ⇒ `null`, SIEMPRE**, aunque el modelo mande un numero: lo que hace legal
  // no bloquear la aceptacion es que no entre un valor incorrecto (ADR 0082 §9). Un `0`
  // aca seria un precio falso que parece valido.
  const unitPrice =
    priceStatus === "detected" ? parseExtractedPrice(item.unitPrice) : null;
  return {
    sourceId,
    name,
    unitPrice,
    // Un `detected` sin precio legible no es `detected`: se degrada, no se inventa.
    priceStatus:
      priceStatus === "detected" && unitPrice === null
        ? "ambiguous"
        : priceStatus,
    sourceText:
      typeof item.sourceText === "string"
        ? sanitizeText(item.sourceText, MAX_SOURCE_TEXT_LENGTH) || null
        : null,
  };
}

/** Reusa `parseOptionalMoney` del catalogo: **no nace una segunda representacion del
 * dinero** (§4). Un precio que no parsea vuelve `null` en vez de tirar — el borrador no se
 * pierde entero porque el modelo escribio «s/d» en un renglon. */
function parseExtractedPrice(value: unknown): string | null {
  try {
    return parseOptionalMoney(value, "El precio");
  } catch (error) {
    if (error instanceof CatalogError) return null;
    throw error;
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`extraction_bad_${label}`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown): string {
  if (typeof value !== "string") throw new Error("extraction_bad_string");
  return value;
}

function requireSourceId(value: unknown, seen: Set<string>): string {
  const id = typeof value === "string" ? sanitizeText(value, 64) : "";
  if (!id) throw new Error("extraction_bad_source_id");
  if (seen.has(id)) throw new Error("extraction_duplicate_source_id");
  seen.add(id);
  return id;
}

function optionalInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}
