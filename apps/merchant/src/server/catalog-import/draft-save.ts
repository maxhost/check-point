import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports, productCategories } from "../schema";
import { CatalogImportError, type CatalogImportDraft } from "./types";
import { validateDraft } from "./draft";
import { requireImport } from "./core";
import { touch } from "./quota";

/**
 * Spec 0090 §6 / contrato §5 — `PUT /imports/{id}/draft`: guardar la revision.
 *
 * **Solo en `ready`** y con **optimistic locking por `draft_version`**: si dos pestañas
 * editan, la segunda recibe `409 catalog_import_version` y tiene que releer en vez de pisar
 * el trabajo de la otra. El `version` del cuerpo es obligatorio acá —a diferencia del
 * `accept`, donde es opcional— porque acá **sí** hay algo que comparar.
 */
export async function saveDraft(
  business: { id: string },
  importId: string,
  value: unknown,
): Promise<{ import: { draft: CatalogImportDraft; version: number } }> {
  const row = await requireImport(business.id, importId);
  if (row.status !== "ready") {
    throw new CatalogImportError(
      409,
      "catalog_import_state",
      "Esa importación ya no se puede editar.",
    );
  }
  const expected = versionOf(value);
  if (expected !== row.draftVersion) {
    throw new CatalogImportError(
      409,
      "catalog_import_version",
      "El borrador cambió. Recargá la revisión antes de guardar.",
    );
  }
  const categories = await getDb()
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.businessId, business.id));
  const draft = validateDraft(value, {
    categoryIds: new Set(categories.map((category) => category.id)),
  });
  const nextVersion = row.draftVersion + 1;
  const [updated] = await getDb()
    .update(catalogImports)
    .set({
      draft: { ...draft, version: nextVersion },
      draftVersion: nextVersion,
      ...touch(),
    })
    .where(
      and(
        eq(catalogImports.id, importId),
        eq(catalogImports.status, "ready"),
        // El `WHERE` repite la version: sin esto, dos `PUT` simultaneos con la misma version
        // leida pasarian los dos y el segundo pisaria al primero sin que nadie se entere.
        eq(catalogImports.draftVersion, row.draftVersion),
      ),
    )
    .returning({
      draft: catalogImports.draft,
      version: catalogImports.draftVersion,
    });
  if (!updated) {
    throw new CatalogImportError(
      409,
      "catalog_import_version",
      "El borrador cambió. Recargá la revisión antes de guardar.",
    );
  }
  return {
    import: {
      draft: updated.draft as CatalogImportDraft,
      version: updated.version,
    },
  };
}

function versionOf(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogImportError(
      422,
      "invalid_catalog_draft",
      "El borrador no es válido.",
    );
  }
  const raw = (value as Record<string, unknown>).version;
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new CatalogImportError(
      422,
      "invalid_catalog_draft",
      "Falta la versión del borrador.",
    );
  }
  return raw;
}
