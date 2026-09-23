import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports, productCategories, products } from "../schema";
import type { ProviderExtraction } from "./types";
import { buildDraft, type CatalogSnapshot } from "./draft";
import { IMPORT_TTL_MS } from "./core";
import { touch } from "./quota";
import { notifyImportFinished } from "./notify";
import { purgeImportObjects } from "./cleanup";

/**
 * Spec 0090 §7 — EL ATERRIZAJE DE UN RESULTADO. Lo comparten el callback, el `poll` del
 * reconciliador y el adaptador sincronico, **y por eso es idempotente**: si el import ya
 * salio de `queued`/`analyzing`, es no-op. Un webhook duplicado no reescribe un borrador que
 * el merchant ya esta editando.
 *
 * Y si hay `cancel_requested_at`, el resultado **se descarta** y el import cierra en
 * `cancelled` limpiando los originales (§1).
 */
export type FinishOutcome = "ready" | "cancelled" | "noop";

export async function finishAnalysis(
  importId: string,
  extraction: ProviderExtraction,
  durationMs: number,
): Promise<FinishOutcome> {
  const [row] = await getDb()
    .select()
    .from(catalogImports)
    .where(eq(catalogImports.id, importId))
    .limit(1);
  if (!row) return "noop";
  if (row.status !== "queued" && row.status !== "analyzing") return "noop";
  if (row.cancelRequestedAt) {
    await getDb()
      .update(catalogImports)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        leaseUntil: null,
        ...touch(),
      })
      .where(
        and(
          eq(catalogImports.id, importId),
          inArray(catalogImports.status, ["queued", "analyzing"]),
        ),
      );
    await purgeImportObjects(importId, row.businessId).catch(() => undefined);
    return "cancelled";
  }
  const draft = buildDraft(extraction, await snapshotOf(row.businessId));
  const [updated] = await getDb()
    .update(catalogImports)
    .set({
      status: "ready",
      draft,
      draftVersion: 1,
      inputTokens: extraction.usage.inputTokens,
      outputTokens: extraction.usage.outputTokens,
      providerRequestId: extraction.providerRequestId,
      durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
      leaseUntil: null,
      // **La ventana se EXTIENDE al pasar a `ready`** (§7): revisar un menu largo no puede
      // vencer mientras se revisa.
      expiresAt: new Date(Date.now() + IMPORT_TTL_MS),
      ...touch(),
    })
    .where(
      and(
        eq(catalogImports.id, importId),
        inArray(catalogImports.status, ["queued", "analyzing"]),
      ),
    )
    .returning({ id: catalogImports.id });
  if (!updated) return "noop";
  // Evento estructurado por transicion. **Jamas el documento ni los nombres de productos**
  // (§9): solo el id, el negocio, el estado y las metricas.
  console.info("catalog_import_ready", {
    importId,
    businessId: row.businessId,
    provider: row.provider,
    model: row.model,
    durationMs: Math.round(durationMs),
    inputTokens: extraction.usage.inputTokens,
    outputTokens: extraction.usage.outputTokens,
    categories: draft.categories.length,
    products: draft.categories.reduce((n, c) => n + c.products.length, 0),
  });
  await notifyImportFinished(importId, "ready").catch(() => undefined);
  return "ready";
}

/** Cierra el import en `failed` con un codigo **saneado** y avisa por email una sola vez.
 * `failed` es terminal: un nuevo intento crea otro import (§1). */
export async function failImport(
  importId: string,
  code: string,
  detail: string,
): Promise<void> {
  const [row] = await getDb()
    .update(catalogImports)
    .set({
      status: "failed",
      failureCode: code,
      failureDetail: detail.slice(0, 300),
      leaseUntil: null,
      ...touch(),
    })
    .where(
      and(
        eq(catalogImports.id, importId),
        inArray(catalogImports.status, [
          "pending_upload",
          "queued",
          "analyzing",
        ]),
      ),
    )
    .returning({
      id: catalogImports.id,
      businessId: catalogImports.businessId,
    });
  if (!row) return;
  console.info("catalog_import_failed", {
    importId,
    businessId: row.businessId,
    code,
  });
  await notifyImportFinished(importId, "failed").catch(() => undefined);
  await purgeImportObjects(importId, row.businessId).catch(() => undefined);
}

/** El catalogo ACTUAL del negocio, para marcar duplicados. Solo id y nombre. */
export async function snapshotOf(businessId: string): Promise<CatalogSnapshot> {
  const db = getDb();
  const [categories, productRows] = await Promise.all([
    db
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(eq(productCategories.businessId, businessId)),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.businessId, businessId)),
  ]);
  return { categories, products: productRows };
}
