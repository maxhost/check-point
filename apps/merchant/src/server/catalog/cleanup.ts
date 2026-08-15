import { asc, eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import { productAssetCleanups, productAssetUploads } from "../schema";
import { deleteObjectKeys, deleteProductPrefix } from "../r2";

async function enqueueProductCleanup(businessId: string, objectPrefix: string) {
  await getDb()
    .insert(productAssetCleanups)
    .values({ businessId, objectPrefix })
    .onConflictDoNothing();
}

/** Deletes a product R2 prefix now; on failure queues it for the idempotent cron retry. */
export async function cleanupProductPrefixNow(
  businessId: string,
  prefix: string,
) {
  try {
    await deleteProductPrefix(prefix);
    await getDb()
      .delete(productAssetCleanups)
      .where(eq(productAssetCleanups.objectPrefix, prefix));
  } catch {
    await enqueueProductCleanup(businessId, prefix).catch(() => undefined);
  }
}

export async function cleanupExpiredCatalogAssets() {
  const now = new Date();
  const expiredUploads = await getDb()
    .select()
    .from(productAssetUploads)
    .where(lt(productAssetUploads.expiresAt, now))
    .limit(100);
  for (const upload of expiredUploads) {
    try {
      await deleteObjectKeys([upload.objectKey]);
      await getDb()
        .delete(productAssetUploads)
        .where(eq(productAssetUploads.id, upload.id));
    } catch {
      // Retain metadata so this object remains eligible for the next cron run.
    }
  }
  const cleanups = await getDb()
    .select()
    .from(productAssetCleanups)
    .where(lt(productAssetCleanups.notBefore, now))
    .orderBy(asc(productAssetCleanups.createdAt))
    .limit(100);
  for (const cleanup of cleanups) {
    try {
      await deleteProductPrefix(cleanup.objectPrefix);
      await getDb()
        .delete(productAssetCleanups)
        .where(eq(productAssetCleanups.id, cleanup.id));
    } catch (error) {
      const attempts = cleanup.attemptCount + 1;
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
      await getDb()
        .update(productAssetCleanups)
        .set({
          attemptCount: attempts,
          notBefore: new Date(Date.now() + delayMinutes * 60 * 1000),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "R2 cleanup failed",
        })
        .where(eq(productAssetCleanups.id, cleanup.id));
    }
  }
  return {
    expiredUploads: expiredUploads.length,
    cleanupJobs: cleanups.length,
  };
}
