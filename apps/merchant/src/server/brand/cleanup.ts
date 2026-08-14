import { asc, eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import { brandAssetCleanups, brandAssetUploads } from "../schema";
import { deleteLogoPrefix, deleteObjectKeys } from "../r2";

export async function enqueueCleanup(businessId: string, objectPrefix: string) {
  await getDb()
    .insert(brandAssetCleanups)
    .values({ businessId, objectPrefix })
    .onConflictDoNothing();
}

/** Deletes an R2 prefix now; on failure, queues it for the idempotent cron retry. */
export async function cleanupPrefixNow(businessId: string, prefix: string) {
  try {
    await deleteLogoPrefix(prefix);
    await getDb()
      .delete(brandAssetCleanups)
      .where(eq(brandAssetCleanups.objectPrefix, prefix));
  } catch {
    await enqueueCleanup(businessId, prefix).catch(() => undefined);
  }
}

export async function cleanupExpiredBrandAssets() {
  const now = new Date();
  const expiredUploads = await getDb()
    .select()
    .from(brandAssetUploads)
    .where(lt(brandAssetUploads.expiresAt, now))
    .limit(100);
  for (const upload of expiredUploads) {
    try {
      await deleteObjectKeys([upload.objectKey]);
      await getDb()
        .delete(brandAssetUploads)
        .where(eq(brandAssetUploads.id, upload.id));
    } catch {
      // Retain metadata so this object remains eligible for the next cron run.
    }
  }
  const cleanups = await getDb()
    .select()
    .from(brandAssetCleanups)
    .where(lt(brandAssetCleanups.notBefore, now))
    .orderBy(asc(brandAssetCleanups.createdAt))
    .limit(100);
  for (const cleanup of cleanups) {
    try {
      await deleteLogoPrefix(cleanup.objectPrefix);
      await getDb()
        .delete(brandAssetCleanups)
        .where(eq(brandAssetCleanups.id, cleanup.id));
    } catch (error) {
      const attempts = cleanup.attemptCount + 1;
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
      await getDb()
        .update(brandAssetCleanups)
        .set({
          attemptCount: attempts,
          notBefore: new Date(Date.now() + delayMinutes * 60 * 1000),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "R2 cleanup failed",
        })
        .where(eq(brandAssetCleanups.id, cleanup.id));
    }
  }
  return {
    expiredUploads: expiredUploads.length,
    cleanupJobs: cleanups.length,
  };
}
