import { and, eq } from "drizzle-orm";
import { withDbTransaction, type DbTransaction } from "../db";
import { catalogImports, productCategories, products } from "../schema";
import { isUniqueViolation } from "../catalog/categories";
import {
  CatalogImportError,
  type AcceptedSummary,
  type CatalogImportDraft,
  type DraftCategory,
} from "./types";
import { normalizeForDuplicate } from "./validation";
import { validateDraft } from "./draft";
import { notFound } from "./core";
import { touch } from "./quota";
import { enqueueImportCleanup, purgeImportObjects } from "./cleanup";

/**
 * Spec 0090 §6/§7 — `accept`: TRANSACCION + `SELECT … FOR UPDATE` del import.
 *
 * **La idempotencia la da el LOCK mas el estado `accepted`, no una clave del cliente**
 * (ADR 0082 §13.3): un doble clic no puede crear el catalogo dos veces y la pantalla no
 * tiene que hacer nada para eso. **No hay `idempotencyKey` en el contrato.**
 *
 * `version` es **opcional**: si viene se valida; si no, no hay nada que comparar porque
 * nadie edito.
 */
export type AcceptOutcome = { created: boolean; result: AcceptedSummary };

export async function acceptImport(
  business: { id: string },
  importId: string,
  value: unknown,
): Promise<AcceptOutcome> {
  if (!/^[0-9a-f-]{36}$/i.test(importId)) throw notFound();
  const expectedVersion = parseVersion(value);
  const outcome = await withDbTransaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(catalogImports)
      .where(
        and(
          eq(catalogImports.id, importId),
          eq(catalogImports.businessId, business.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!row) throw notFound();
    // **EL CHEQUEO QUE HACE IDEMPOTENTE AL DOBLE CLIC.** Bajo el lock, un import ya aceptado
    // devuelve el MISMO resumen guardado y no vuelve a escribir una sola fila.
    if (row.status === "accepted") {
      return {
        created: false,
        result: (row.acceptedSummary as AcceptedSummary) ?? {
          importId,
          categoriesCreated: 0,
          productsCreated: 0,
          productsWithoutPrice: 0,
        },
      };
    }
    if (row.status !== "ready") {
      throw new CatalogImportError(
        409,
        "catalog_import_state",
        "Esa importación no está lista para aceptar.",
      );
    }
    if (expectedVersion !== null && expectedVersion !== row.draftVersion) {
      throw new CatalogImportError(
        409,
        "catalog_import_version",
        "El borrador cambió. Recargá la revisión antes de aceptar.",
      );
    }
    const draft = await revalidate(tx, business.id, row.draft);
    assertResolved(draft);
    const summary = await createCatalog(tx, business.id, importId, draft);
    await tx
      .update(catalogImports)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedSummary: summary,
        ...touch(),
      })
      .where(eq(catalogImports.id, importId));
    return { created: true, result: summary };
  });
  if (outcome.created) {
    // **Despues del commit** (§6.6): un borrado de R2 adentro de la transaccion la alargaria
    // sosteniendo el lock, y si fallara no habria nada que revertir igual.
    await enqueueImportCleanup(importId, business.id).catch(() => undefined);
    await purgeImportObjects(importId, business.id).catch(() => undefined);
  }
  return outcome;
}

function parseVersion(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>).version;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new CatalogImportError(
      422,
      "invalid_catalog_draft",
      "La versión del borrador no es válida.",
    );
  }
  return raw;
}

/** Revalida el borrador contra el catalogo **ACTUAL**: los ids que ya no existen y los de
 * otro negocio se caen aca, no al insertar. */
async function revalidate(
  tx: DbTransaction,
  businessId: string,
  draft: unknown,
): Promise<CatalogImportDraft> {
  const rows = await tx
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.businessId, businessId));
  return validateDraft(draft, {
    categoryIds: new Set(rows.map((row) => row.id)),
  });
}

/**
 * §5 — **NO SE PIERDEN PRODUCTOS IMPLICITAMENTE.** Una categoria `discard` exige que cada
 * producto suyo este `include:false` o haya sido reasignado a otra categoria del borrador
 * (o sea: movido de array). Si queda uno colgado, el `accept` responde 409.
 */
function assertResolved(draft: CatalogImportDraft): void {
  for (const category of draft.categories) {
    if (category.resolution.kind !== "discard") continue;
    if (category.products.some((product) => product.include)) {
      throw new CatalogImportError(
        409,
        "unresolved_catalog_import",
        "Quedan productos en una categoría descartada.",
      );
    }
  }
}

async function createCatalog(
  tx: DbTransaction,
  businessId: string,
  importId: string,
  draft: CatalogImportDraft,
): Promise<AcceptedSummary> {
  const createdByName = new Map<string, string>();
  let categoriesCreated = 0;
  const categoryOf = new Map<string, string | null>();
  for (const category of draft.categories) {
    if (category.resolution.kind === "discard") continue;
    if (category.resolution.kind === "uncategorized") {
      categoryOf.set(category.draftId, null);
      continue;
    }
    if (category.resolution.kind === "use_existing") {
      categoryOf.set(category.draftId, category.resolution.categoryId);
      continue;
    }
    // `create`: una sola vez por nombre normalizado, aunque el borrador lo repita.
    const key = normalizeForDuplicate(category.name);
    const existing = createdByName.get(key);
    if (existing) {
      categoryOf.set(category.draftId, existing);
      continue;
    }
    if (!includesAnyProduct(category)) {
      // Una categoria `create` sin un solo producto incluido no crea nada: importar un menu
      // no puede dejar categorias vacias que el merchant no pidio.
      categoryOf.set(category.draftId, null);
      continue;
    }
    const id = await insertCategory(tx, businessId, category.name);
    createdByName.set(key, id);
    categoryOf.set(category.draftId, id);
    categoriesCreated += 1;
  }

  const rows = draft.categories.flatMap((category) =>
    category.resolution.kind === "discard"
      ? []
      : category.products
          .filter((product) => product.include)
          .map((product) => ({
            businessId,
            categoryId: categoryOf.get(category.draftId) ?? null,
            name: product.name,
            // **`unitPrice` NULL para un ambiguo, NUNCA `0`.** Cero es un precio falso que
            // parece valido y era la razon de ser del bloqueo que esta spec sacó.
            unitPrice: product.unitPrice,
            unitCost: null,
            availableAllLocations: true,
          })),
  );
  if (rows.length > 0) {
    // En bulk y **sin una sola fila `product_location`**: nacen disponibles en todos los
    // locales (§6.4).
    await tx.insert(products).values(rows);
  }
  return {
    importId,
    categoriesCreated,
    productsCreated: rows.length,
    productsWithoutPrice: rows.filter((row) => row.unitPrice === null).length,
  };
}

function includesAnyProduct(category: DraftCategory): boolean {
  return category.products.some((product) => product.include);
}

/** Un 23505 del indice `core_product_category_name_unique` es **409
 * `catalog_import_conflict`**, no un 500: el nombre aparecio en el catalogo entre la revision
 * y el accept, y nunca se fusiona en silencio. */
async function insertCategory(
  tx: DbTransaction,
  businessId: string,
  name: string,
): Promise<string> {
  try {
    const [row] = await tx
      .insert(productCategories)
      .values({ businessId, name })
      .returning({ id: productCategories.id });
    return row.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new CatalogImportError(
        409,
        "catalog_import_conflict",
        "Una categoría del borrador ya existe en tu catálogo. Volvé a revisarlo.",
      );
    }
    throw error;
  }
}
