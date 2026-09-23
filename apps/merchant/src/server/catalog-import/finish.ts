import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports } from "../schema";
import type { ProviderExtraction } from "./types";
import { writeImportedCatalog } from "./write";
import { touch } from "./quota";
import { notifyImportFinished } from "./notify";
import { purgeImportObjects } from "./cleanup";

/**
 * Spec 0091 §7 — EL ATERRIZAJE DE UN RESULTADO. Lo comparten el callback, el `poll` del
 * reconciliador y el adaptador sincronico, **y por eso es idempotente**: si el import ya
 * salio de `queued`/`analyzing`, es no-op.
 *
 * No hay paso intermedio: el resultado del proveedor se persiste y el catalogo se escribe en
 * la MISMA invocacion (ADR 0084 §5). Si hay `cancel_requested_at`, el resultado **se
 * descarta** y el import cierra en `cancelled` limpiando los originales.
 */
export type FinishOutcome = "accepted" | "cancelled" | "noop";

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
  // §7 — la extraccion CRUDA se guarda en `draft`, que **deja de ser un borrador editable**:
  // es el resultado persistido para diagnostico, y sigue siendo el discriminante del cupo
  // `analyses` (`quota.ts:60-70`), que cuenta `draft is not null`.
  await getDb()
    .update(catalogImports)
    .set({
      draft: extraction,
      inputTokens: extraction.usage.inputTokens,
      outputTokens: extraction.usage.outputTokens,
      providerRequestId: extraction.providerRequestId,
      durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
      ...touch(),
    })
    .where(
      and(
        eq(catalogImports.id, importId),
        inArray(catalogImports.status, ["queued", "analyzing"]),
      ),
    );
  const written = await writeImportedCatalog(
    importId,
    row.businessId,
    extraction,
  );
  if (!written) return "noop";
  // Evento estructurado por transicion. **Jamas el documento ni los nombres de productos**
  // (§9): solo el id, el negocio, el estado y las metricas.
  console.info("catalog_import_accepted", {
    importId,
    businessId: row.businessId,
    provider: row.provider,
    model: row.model,
    durationMs: Math.round(durationMs),
    inputTokens: extraction.usage.inputTokens,
    outputTokens: extraction.usage.outputTokens,
    categoriesCreated: written.result.categoriesCreated,
    categoriesReused: written.result.categoriesReused,
    productsCreated: written.result.productsCreated,
    productsSkipped: written.result.productsSkipped,
    productsWithoutPrice: written.result.productsWithoutPrice,
    discardedCount: written.result.discardedCount,
  });
  // §7 — el email sale UNA sola vez y **despues del resultado final**, nunca a mitad.
  await notifyImportFinished(importId, "accepted").catch(() => undefined);
  return "accepted";
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
