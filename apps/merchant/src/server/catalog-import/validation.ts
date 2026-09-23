import { ACCEPTED_IMAGE_CONTENT_TYPE_SET } from "../../lib/image-formats";
import { PDF_CONTENT_TYPE } from "../../lib/image-formats";
import {
  CatalogImportError,
  type DiscardedItem,
  type ExtractedCategory,
  type ExtractedProduct,
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
/** El tope de productos de UNA extraccion. Excederlo FALLA, no trunca (§2). */
export const MAX_EXTRACTED_PRODUCTS = 250;
/** Los del catalogo real (`catalog/validation.ts:111,152`). No nacen otros. */
export const MAX_PRODUCT_NAME = 120;
export const MAX_CATEGORY_NAME = 60;
export const MAX_WARNINGS = 20;
export const MAX_WARNING_LENGTH = 300;
/** El fragmento impreso del precio que el servidor parsea (§4). */
export const MAX_PRICE_TEXT_LENGTH = 60;
/** §5 — el texto con el que un descarte se muestra en el resumen. */
export const MAX_DISCARDED_TEXT = 120;
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

/**
 * §4/§5 — LA SALIDA DEL PROVEEDOR SIEMPRE SE VALIDA CONTRA ESTE ESQUEMA CERRADO, aunque el
 * proveedor prometa JSON Schema.
 *
 * **Lo que no cumple ya no tumba la extraccion entera: se DESCARTA y se lista** (§5). Un
 * renglon roto en la pagina 6 de un menu de 90 productos no puede costar el analisis del dia;
 * lo que si sigue fallando explicitamente es el tope de productos, que es un limite del
 * producto y no un defecto de lectura.
 */
export function validateProviderExtraction(value: unknown): ProviderExtraction {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("extraction_not_an_object");
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.categories)) {
    throw new Error("extraction_no_categories");
  }
  const discarded: DiscardedItem[] = [];
  const seenCategoryIds = new Set<string>();
  const seenProductIds = new Set<string>();
  const categories: ExtractedCategory[] = [];
  let productCount = 0;
  for (const entry of raw.categories) {
    const category = asObject(entry);
    const rawProducts =
      category && Array.isArray(category.products) ? category.products : null;
    const sourceId = category
      ? readSourceId(category.sourceId, seenCategoryIds)
      : null;
    const name = category
      ? sanitizeText(asString(category.name), MAX_CATEGORY_NAME)
      : "";
    productCount += rawProducts?.length ?? 0;
    if (productCount > MAX_EXTRACTED_PRODUCTS) {
      // §2: excederlo FALLA EXPLICITAMENTE, no trunca.
      throw new Error("extraction_too_many_products");
    }
    if (!sourceId || !name || !rawProducts) {
      // §5 — **una categoria entera invalida DESCARTA sus productos**, uno por uno, para que
      // el merchant los vea en el resumen en vez de que desaparezcan en silencio.
      for (const item of rawProducts ?? [entry]) {
        discarded.push({ text: discardText(item), reason: "invalid_row" });
      }
      continue;
    }
    const products: ExtractedProduct[] = [];
    for (const item of rawProducts) {
      const parsed = parseExtractedProduct(item, seenProductIds);
      if ("reason" in parsed) discarded.push(parsed);
      else products.push(parsed);
    }
    categories.push({ sourceId, name, products });
  }
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings
        .slice(0, MAX_WARNINGS)
        .map((warning) => sanitizeText(String(warning), MAX_WARNING_LENGTH))
        .filter((warning) => warning.length > 0)
    : [];
  const usage = raw.usage as Record<string, unknown> | undefined;
  return {
    categories,
    discarded,
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

/**
 * §5 — un item se DESCARTA cuando su nombre queda vacio despues de sanitizar, cuando supera
 * `MAX_PRODUCT_NAME` (se descarta, **no se recorta**: un nombre cortado a la mitad es un
 * producto inventado) o cuando su fila no cumple el esquema.
 */
function parseExtractedProduct(
  value: unknown,
  seen: Set<string>,
): ExtractedProduct | DiscardedItem {
  const item = asObject(value);
  const sourceId = item ? readSourceId(item.sourceId, seen) : null;
  if (!item || !sourceId || typeof item.name !== "string") {
    return { text: discardText(value), reason: "invalid_row" };
  }
  // Se sanea con UN caracter de margen para poder distinguir «entra justo» de «se paso».
  const name = sanitizeText(item.name, MAX_PRODUCT_NAME + 1);
  if (!name || name.length > MAX_PRODUCT_NAME) {
    return { text: discardText(value), reason: "unreadable_name" };
  }
  return {
    sourceId,
    name,
    priceText:
      typeof item.priceText === "string"
        ? sanitizeText(item.priceText, MAX_PRICE_TEXT_LENGTH) || null
        : null,
  };
}

/** El texto con el que un descarte se muestra: lo que se vio, saneado y recortado a 120. */
function discardText(value: unknown): string {
  const item = asObject(value);
  if (typeof value === "string") return sanitizeText(value, MAX_DISCARDED_TEXT);
  if (item && typeof item.name === "string") {
    return sanitizeText(item.name, MAX_DISCARDED_TEXT);
  }
  try {
    return sanitizeText(JSON.stringify(value) ?? "", MAX_DISCARDED_TEXT);
  } catch {
    return "";
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** `null` cuando falta, no es string o **se repite**: un id duplicado es una fila rota. */
function readSourceId(value: unknown, seen: Set<string>): string | null {
  const id = typeof value === "string" ? sanitizeText(value, 64) : "";
  if (!id || seen.has(id)) return null;
  seen.add(id);
  return id;
}

function optionalInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}
