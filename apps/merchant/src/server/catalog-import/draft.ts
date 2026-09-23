import {
  CatalogImportError,
  type CatalogImportDraft,
  type CategoryResolution,
  type DraftCategory,
  type DraftProduct,
  type ProviderExtraction,
} from "./types";
import {
  MAX_CATEGORY_NAME,
  MAX_DRAFT_PRODUCTS,
  MAX_PRODUCT_NAME,
  MAX_SOURCE_TEXT_LENGTH,
  MAX_WARNINGS,
  MAX_WARNING_LENGTH,
  normalizeForDuplicate,
  sanitizeText,
} from "./validation";
import { parseOptionalMoney } from "../catalog/validation";
import { CatalogError } from "../catalog/core";

/** Lo que el negocio YA tiene, para marcar duplicados. Nombres tal cual estan guardados. */
export type CatalogSnapshot = {
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
};

const badDraft = (message: string) =>
  new CatalogImportError(422, "invalid_catalog_draft", message);

/**
 * Spec 0090 §5 — EL BORRADOR a partir de la extraccion, con los duplicados marcados.
 *
 * **`duplicateCandidate` es un AVISO, no una seleccion**: nada se fusiona solo. La igualdad
 * es `lower(trim(name))`, **la misma normalizacion del indice real**
 * `core_product_category_name_unique` sobre `(business_id, lower(name))`
 * (`schema/catalog.ts:30-33`). Las categorias nuevas se guardan trimmeadas
 * (`catalog/validation.ts:151`), asi que el unico caso donde las dos normalizaciones
 * difieren es una fila vieja con espacios al borde. No hay fuzzy merge.
 */
export function buildDraft(
  extraction: ProviderExtraction,
  snapshot: CatalogSnapshot,
): CatalogImportDraft {
  const categoryByName = new Map(
    snapshot.categories.map((row) => [normalizeForDuplicate(row.name), row]),
  );
  const productByName = new Map(
    snapshot.products.map((row) => [normalizeForDuplicate(row.name), row]),
  );
  const categories: DraftCategory[] = extraction.categories.map((category) => {
    const existing = categoryByName.get(normalizeForDuplicate(category.name));
    return {
      draftId: category.sourceId,
      name: category.name,
      // Siempre `create`: resolver por nosotros seria fusionar en silencio.
      resolution: { kind: "create" },
      duplicateCandidate: existing
        ? { categoryId: existing.id, name: existing.name }
        : null,
      products: category.products.map((product) => {
        const match = productByName.get(normalizeForDuplicate(product.name));
        return {
          draftId: product.sourceId,
          name: product.name,
          unitPrice: product.unitPrice,
          priceStatus: product.priceStatus,
          sourceText: product.sourceText,
          include: true,
          duplicateCandidate: match
            ? { productId: match.id, name: match.name }
            : null,
        };
      }),
    };
  });
  return { version: 1, categories, warnings: extraction.warnings };
}

/**
 * §6 — LA REVALIDACION del borrador que llega por `PUT` (y la del `accept` contra el
 * catalogo ACTUAL). Revalida ids del negocio, nombres, precios, el tope de 250 y las
 * resoluciones.
 */
export function validateDraft(
  value: unknown,
  ctx: { categoryIds: Set<string> },
): CatalogImportDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badDraft("El borrador no es válido.");
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.categories)) {
    throw badDraft("El borrador no trae categorías.");
  }
  const version =
    typeof raw.version === "number" && Number.isInteger(raw.version)
      ? raw.version
      : 0;
  let productCount = 0;
  const seenDraftIds = new Set<string>();
  const categories = raw.categories.map((entry) => {
    const category = parseDraftCategory(entry, ctx, seenDraftIds);
    productCount += category.products.length;
    if (productCount > MAX_DRAFT_PRODUCTS) {
      throw badDraft(
        `Un borrador admite como máximo ${MAX_DRAFT_PRODUCTS} productos.`,
      );
    }
    return category;
  });
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings
        .slice(0, MAX_WARNINGS)
        .map((warning) => sanitizeText(String(warning), MAX_WARNING_LENGTH))
        .filter((warning) => warning.length > 0)
    : [];
  return { version, categories, warnings };
}

function parseDraftCategory(
  value: unknown,
  ctx: { categoryIds: Set<string> },
  seen: Set<string>,
): DraftCategory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badDraft("Hay una categoría inválida en el borrador.");
  }
  const raw = value as Record<string, unknown>;
  const draftId = requireDraftId(raw.draftId, seen);
  const name = sanitizeText(
    typeof raw.name === "string" ? raw.name : "",
    MAX_CATEGORY_NAME,
  );
  const resolution = parseResolution(raw.resolution, ctx);
  // Una categoria `discard` o `uncategorized` no crea nada, asi que su nombre puede estar
  // vacio; una que va a crearse necesita nombre porque `core.product_category.name` es
  // `NOT NULL` y el catalogo exige 1-60.
  if (!name && resolution.kind === "create") {
    throw badDraft("El nombre de la categoría es obligatorio (máximo 60).");
  }
  if (!Array.isArray(raw.products)) {
    throw badDraft("Una categoría del borrador no trae productos.");
  }
  return {
    draftId,
    name,
    resolution,
    duplicateCandidate: parseCategoryCandidate(raw.duplicateCandidate, ctx),
    products: raw.products.map((product) => parseDraftProduct(product, seen)),
  };
}

function parseResolution(
  value: unknown,
  ctx: { categoryIds: Set<string> },
): CategoryResolution {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badDraft("La resolución de una categoría no es válida.");
  }
  const raw = value as Record<string, unknown>;
  if (raw.kind === "create") return { kind: "create" };
  if (raw.kind === "uncategorized") return { kind: "uncategorized" };
  if (raw.kind === "discard") return { kind: "discard" };
  if (raw.kind === "use_existing") {
    const categoryId = typeof raw.categoryId === "string" ? raw.categoryId : "";
    // El aislamiento por negocio: un id que no esta en el set es de otro negocio o no
    // existe, y las dos cosas contestan lo mismo.
    if (!ctx.categoryIds.has(categoryId)) {
      throw badDraft("La categoría elegida no pertenece a tu negocio.");
    }
    return { kind: "use_existing", categoryId };
  }
  throw badDraft("La resolución de una categoría no es válida.");
}

function parseCategoryCandidate(
  value: unknown,
  ctx: { categoryIds: Set<string> },
): DraftCategory["duplicateCandidate"] {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badDraft("El duplicado sugerido no es válido.");
  }
  const raw = value as Record<string, unknown>;
  const categoryId = typeof raw.categoryId === "string" ? raw.categoryId : "";
  // Un candidato que ya no existe se descarta en silencio: es un aviso, y el catalogo pudo
  // cambiar entre la revision y el guardado.
  if (!ctx.categoryIds.has(categoryId)) return null;
  return {
    categoryId,
    name: sanitizeText(
      typeof raw.name === "string" ? raw.name : "",
      MAX_CATEGORY_NAME,
    ),
  };
}

function parseDraftProduct(value: unknown, seen: Set<string>): DraftProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badDraft("Hay un producto inválido en el borrador.");
  }
  const raw = value as Record<string, unknown>;
  const draftId = requireDraftId(raw.draftId, seen);
  const name = sanitizeText(
    typeof raw.name === "string" ? raw.name : "",
    MAX_PRODUCT_NAME,
  );
  const include = raw.include !== false;
  if (!name && include) {
    throw badDraft("El nombre del producto es obligatorio (máximo 120).");
  }
  const priceStatus = raw.priceStatus === "detected" ? "detected" : "ambiguous";
  return {
    draftId,
    name,
    unitPrice: parseDraftPrice(raw.unitPrice, priceStatus),
    priceStatus,
    sourceText:
      typeof raw.sourceText === "string"
        ? sanitizeText(raw.sourceText, MAX_SOURCE_TEXT_LENGTH) || null
        : null,
    include,
    duplicateCandidate: parseProductCandidate(raw.duplicateCandidate),
  };
}

/**
 * **La plata es un STRING decimal, y un numero es 422** (contrato §4): «la plata en este repo
 * no pasa por el punto flotante». Y un `ambiguous` **siempre** vale `null`, venga lo que
 * venga en el cuerpo — es lo unico que hace seguro no bloquear la aceptacion.
 */
function parseDraftPrice(
  value: unknown,
  priceStatus: "detected" | "ambiguous",
): string | null {
  if (priceStatus === "ambiguous") return null;
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw badDraft("El precio tiene que ser un texto decimal, no un número.");
  }
  try {
    return parseOptionalMoney(value, "El precio");
  } catch (error) {
    if (error instanceof CatalogError) throw badDraft(error.message);
    throw error;
  }
}

function parseProductCandidate(
  value: unknown,
): DraftProduct["duplicateCandidate"] {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const productId = typeof raw.productId === "string" ? raw.productId : "";
  if (!productId) return null;
  return {
    productId,
    name: sanitizeText(
      typeof raw.name === "string" ? raw.name : "",
      MAX_PRODUCT_NAME,
    ),
  };
}

function requireDraftId(value: unknown, seen: Set<string>): string {
  const id = typeof value === "string" ? sanitizeText(value, 64) : "";
  if (!id) throw badDraft("Falta el identificador de una fila del borrador.");
  if (seen.has(id)) throw badDraft("Hay identificadores repetidos.");
  seen.add(id);
  return id;
}
