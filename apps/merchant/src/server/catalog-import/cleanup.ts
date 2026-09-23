import { and, asc, eq, inArray, lte, ne } from "drizzle-orm";
import { getDb } from "../db";
import {
  CATALOG_IMPORT_OPEN_STATUSES,
  catalogImportCleanups,
  catalogImportFiles,
  catalogImports,
} from "../schema";
import { deleteObjectKeys } from "../r2";
import { touch } from "./quota";

/**
 * Spec 0090 §7 — LIMPIEZA DE LOS ORIGINALES. Cuelga del `assets-cleanup` diario que ya
 * existe y **nunca toca catalogo**.
 *
 * La cola es propia (`core.catalog_import_cleanup`) y **no** se reusa
 * `core.product_asset_cleanup`: su worker borra por *prefijo de producto*
 * (`deleteProductPrefix`), que sobre una clave de import intentaria borrar
 * `<clave>/product.webp` y dejaria el original vivo para siempre.
 */

/** Cuantas filas de cola se drenan por corrida. */
const CLEANUP_BATCH = 100;

/** Encola el borrado de cada original del import. Idempotente por `object_key` unico. */
export async function enqueueImportCleanup(
  importId: string,
  businessId: string,
): Promise<number> {
  const files = await getDb()
    .select({ objectKey: catalogImportFiles.objectKey })
    .from(catalogImportFiles)
    .where(
      and(
        eq(catalogImportFiles.importId, importId),
        ne(catalogImportFiles.status, "deleted"),
      ),
    );
  if (files.length === 0) return 0;
  await getDb()
    .insert(catalogImportCleanups)
    .values(files.map((file) => ({ businessId, objectKey: file.objectKey })))
    .onConflictDoNothing();
  return files.length;
}

/**
 * Borra los originales **ahora** (patron `cleanupProductPrefixNow`). Lo que falle queda en
 * la cola; repetirlo es no-op. Marca `cleaned_at` solo cuando no queda ningun archivo vivo.
 */
export async function purgeImportObjects(
  importId: string,
  businessId: string,
): Promise<{ deleted: number; pending: number }> {
  const files = await getDb()
    .select({
      id: catalogImportFiles.id,
      objectKey: catalogImportFiles.objectKey,
    })
    .from(catalogImportFiles)
    .where(
      and(
        eq(catalogImportFiles.importId, importId),
        ne(catalogImportFiles.status, "deleted"),
      ),
    );
  if (files.length === 0) {
    await markCleaned(importId);
    return { deleted: 0, pending: 0 };
  }
  let deleted = 0;
  for (const file of files) {
    try {
      await deleteObjectKeys([file.objectKey]);
      await getDb()
        .update(catalogImportFiles)
        .set({ status: "deleted", deletedAt: new Date() })
        .where(eq(catalogImportFiles.id, file.id));
      await getDb()
        .delete(catalogImportCleanups)
        .where(eq(catalogImportCleanups.objectKey, file.objectKey));
      deleted += 1;
    } catch {
      await getDb()
        .insert(catalogImportCleanups)
        .values({ businessId, objectKey: file.objectKey })
        .onConflictDoNothing();
    }
  }
  const pending = files.length - deleted;
  if (pending === 0) await markCleaned(importId);
  return { deleted, pending };
}

async function markCleaned(importId: string): Promise<void> {
  await getDb()
    .update(catalogImports)
    .set({ cleanedAt: new Date(), ...touch() })
    .where(eq(catalogImports.id, importId));
}

/**
 * La corrida diaria: vence los no terminales, borra sus originales y reintenta la cola.
 * **No toca catalogo** ni en el camino feliz ni en el de error.
 */
export async function cleanupExpiredCatalogImports(): Promise<{
  expired: number;
  purged: number;
  retried: number;
}> {
  const now = new Date();
  const expirable = await getDb()
    .select({ id: catalogImports.id, businessId: catalogImports.businessId })
    .from(catalogImports)
    .where(
      and(
        inArray(catalogImports.status, [...CATALOG_IMPORT_OPEN_STATUSES]),
        lte(catalogImports.expiresAt, now),
      ),
    )
    .limit(CLEANUP_BATCH);
  for (const row of expirable) {
    await getDb()
      .update(catalogImports)
      .set({ status: "expired", ...touch() })
      .where(
        and(
          eq(catalogImports.id, row.id),
          inArray(catalogImports.status, [...CATALOG_IMPORT_OPEN_STATUSES]),
        ),
      );
    await enqueueImportCleanup(row.id, row.businessId).catch(() => undefined);
  }
  let purged = 0;
  for (const row of expirable) {
    const result = await purgeImportObjects(row.id, row.businessId).catch(
      () => ({ deleted: 0, pending: 0 }),
    );
    purged += result.deleted;
  }
  const retried = await drainCleanupQueue(now);
  return { expired: expirable.length, purged, retried };
}

/** Reintenta lo pendiente con backoff exponencial acotado a 24 h, igual que la cola de
 * productos. Un borrado que ya ocurrio es un no-op del lado de R2. */
export async function drainCleanupQueue(
  now: Date = new Date(),
): Promise<number> {
  const jobs = await getDb()
    .select()
    .from(catalogImportCleanups)
    .where(lte(catalogImportCleanups.notBefore, now))
    .orderBy(asc(catalogImportCleanups.createdAt))
    .limit(CLEANUP_BATCH);
  for (const job of jobs) {
    try {
      await deleteObjectKeys([job.objectKey]);
      await getDb()
        .update(catalogImportFiles)
        .set({ status: "deleted", deletedAt: new Date() })
        .where(eq(catalogImportFiles.objectKey, job.objectKey));
      await getDb()
        .delete(catalogImportCleanups)
        .where(eq(catalogImportCleanups.id, job.id));
    } catch (error) {
      const attempts = job.attemptCount + 1;
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
      await getDb()
        .update(catalogImportCleanups)
        .set({
          attemptCount: attempts,
          notBefore: new Date(now.getTime() + delayMinutes * 60 * 1000),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "R2 cleanup failed",
        })
        .where(eq(catalogImportCleanups.id, job.id));
    }
  }
  return jobs.length;
}
