import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports } from "../schema";
import type { CatalogExtractionProvider } from "./types";
import { catalogExtractionProviderFromEnv } from "./providers/provider";
import { ANALYZE_LEASE_MS, MAX_ATTEMPTS, runAnalysis } from "./prepare";
import { failImport, finishAnalysis } from "./finish";
import { purgeImportObjects } from "./cleanup";
import { touch } from "./quota";

/**
 * Spec 0090 §7 — EL RECONCILIADOR. Lo dispara `.github/workflows/catalog-import-reconcile.yml`
 * cada 5 minutos con el `CRON_SECRET` que ya usan las internas.
 *
 * **Es lo que impide que `analyzing` sea un pozo**: un `after()` que muere o un webhook
 * perdido dejarian al negocio sin poder importar nunca mas, porque solo puede haber un import
 * no terminal por negocio. Y es ademas **la unica forma de que esto funcione en local y en
 * preview**, donde el endpoint del dashboard del proveedor no apunta.
 *
 * Reclama con un lease (`lease_until`), que es lo que hace que dos corridas concurrentes
 * tomen cada fila **una sola vez**.
 */
export type ReconcileSummary = {
  requeued: number;
  polled: number;
  completed: number;
  failed: number;
  cancelled: number;
};

const BATCH = 20;

export async function runCatalogImportReconcile(
  deps: { provider?: CatalogExtractionProvider; now?: Date } = {},
): Promise<ReconcileSummary> {
  const now = deps.now ?? new Date();
  const summary: ReconcileSummary = {
    requeued: 0,
    polled: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  let provider: CatalogExtractionProvider | null = null;
  try {
    provider = deps.provider ?? catalogExtractionProviderFromEnv();
  } catch {
    provider = null;
  }

  // 1. Los `queued` viejos: el `after()` murio antes de submitear. `runAnalysis` reclama con
  //    su propio lease, asi que acá solo hace falta elegir candidatos.
  const stale = await getDb()
    .select({ id: catalogImports.id })
    .from(catalogImports)
    .where(
      and(
        eq(catalogImports.status, "queued"),
        or(
          isNull(catalogImports.leaseUntil),
          lte(catalogImports.leaseUntil, now),
        ),
      ),
    )
    .limit(BATCH);
  for (const row of stale) {
    const outcome = await runAnalysis(
      row.id,
      provider ? { provider } : {},
    ).catch(() => "failed" as const);
    if (outcome === "submitted" || outcome === "ready") summary.requeued += 1;
    if (outcome === "failed") summary.failed += 1;
    if (outcome === "cancelled") summary.cancelled += 1;
  }

  // 2. Los `analyzing` con lease vencido: se pollea al proveedor.
  const expired = await getDb()
    .update(catalogImports)
    .set({
      leaseUntil: new Date(now.getTime() + ANALYZE_LEASE_MS),
      attemptCount: sql`${catalogImports.attemptCount} + 1`,
      ...touch(),
    })
    .where(
      and(
        eq(catalogImports.status, "analyzing"),
        or(
          isNull(catalogImports.leaseUntil),
          lte(catalogImports.leaseUntil, now),
        ),
      ),
    )
    .returning();
  for (const row of expired) {
    if (row.cancelRequestedAt) {
      await closeCancelled(row.id, row.businessId);
      summary.cancelled += 1;
      continue;
    }
    if (row.attemptCount > MAX_ATTEMPTS) {
      await failImport(
        row.id,
        "provider_unavailable",
        "El análisis no respondió a tiempo.",
      );
      summary.failed += 1;
      continue;
    }
    if (!row.providerJobId) {
      // Submiteo a medias: se lo devuelve a `queued` para que el camino normal lo rehaga.
      await getDb()
        .update(catalogImports)
        .set({ status: "queued", leaseUntil: null, ...touch() })
        .where(
          and(
            eq(catalogImports.id, row.id),
            eq(catalogImports.status, "analyzing"),
          ),
        );
      summary.requeued += 1;
      continue;
    }
    if (!provider?.poll) continue;
    summary.polled += 1;
    try {
      const result = await provider.poll(row.providerJobId);
      // `pending` NO es un error: el lease ya se renovo arriba y se vuelve en 5 minutos.
      if (result.status === "pending") continue;
      if (result.status === "failed") {
        await failImport(
          row.id,
          "provider_unavailable",
          result.code.slice(0, 120),
        );
        summary.failed += 1;
        continue;
      }
      const elapsed = now.getTime() - row.createdAt.getTime();
      const outcome = await finishAnalysis(row.id, result.extraction, elapsed);
      if (outcome === "ready") summary.completed += 1;
      if (outcome === "cancelled") summary.cancelled += 1;
    } catch {
      // Un fallo de red del poll no quema el import: el lease vence y se reintenta hasta
      // `MAX_ATTEMPTS`.
    }
  }
  return summary;
}

async function closeCancelled(
  importId: string,
  businessId: string,
): Promise<void> {
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
  await purgeImportObjects(importId, businessId).catch(() => undefined);
}
