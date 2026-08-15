import { randomUUID } from "node:crypto";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  loyaltyAssetCleanups,
  loyaltyAssetUploads,
  loyaltyPrograms,
} from "../schema";
import { AssetImageError, normalizeImage } from "../assets/image";
import {
  MAX_LOGO_BYTES,
  deleteObjectKeys,
  deleteStampPrefix,
  getPrivateObject,
  putStampVariants,
  readObjectAtMost,
  stampObjectPrefix,
  stampTemporaryObjectKey,
} from "../r2";
import { LoyaltyError, type StampAction } from "./core";
import {
  ACCEPTED_IMAGE_CONTENT_TYPE_SET,
  ACCEPTED_IMAGE_LABEL,
} from "../../lib/image-formats";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The stamp column changes plus the R2 prefixes to clean up. `null` means "keep". */
export type StampChange = {
  objectKey: string | null;
  rollback: string | null;
  previous: string | null;
} | null;

export async function createStampUpload(businessId: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LoyaltyError(422, "La carga no es válida.");
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.contentType !== "string" ||
    !ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(input.contentType)
  ) {
    throw new LoyaltyError(422, `El sello debe ser ${ACCEPTED_IMAGE_LABEL}.`);
  }
  if (
    !Number.isInteger(input.byteSize) ||
    Number(input.byteSize) < 1 ||
    Number(input.byteSize) > MAX_LOGO_BYTES
  ) {
    throw new LoyaltyError(422, "El sello debe pesar como máximo 5 MB.");
  }
  const id = randomUUID();
  const objectKey = stampTemporaryObjectKey(businessId, id);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await getDb()
    .insert(loyaltyAssetUploads)
    .values({
      id,
      businessId,
      objectKey,
      contentType: input.contentType,
      byteSize: Number(input.byteSize),
      expiresAt,
    });
  try {
    const { createTemporaryUploadUrl } = await import("../r2");
    const uploadUrl = await createTemporaryUploadUrl({
      objectKey,
      contentType: input.contentType,
      byteSize: Number(input.byteSize),
    });
    return { uploadId: id, uploadUrl, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    await getDb()
      .delete(loyaltyAssetUploads)
      .where(eq(loyaltyAssetUploads.id, id));
    throw error;
  }
}

async function consumeStampUpload(businessId: string, uploadId: string) {
  const [upload] = await getDb()
    .update(loyaltyAssetUploads)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(loyaltyAssetUploads.id, uploadId),
        eq(loyaltyAssetUploads.businessId, businessId),
        sql`${loyaltyAssetUploads.consumedAt} is null`,
        sql`${loyaltyAssetUploads.expiresAt} > now()`,
      ),
    )
    .returning();
  if (!upload)
    throw new LoyaltyError(
      409,
      "Esta carga de sello expiró o ya fue utilizada. Selecciónala de nuevo.",
    );
  return upload;
}

/**
 * Applies the R2 side of a stamp change (processing + upload for `replace`) and
 * returns the column values and the prefixes to clean up. Runs before the DB write,
 * mirroring the brand pipeline; the caller rolls back `rollback` if the write fails.
 */
export async function resolveStampChange(args: {
  businessId: string;
  programId: string;
  currentKey: string | null;
  action: StampAction;
  uploadId?: string;
}): Promise<StampChange> {
  if (args.action === "keep") return null;
  if (args.action === "remove") {
    return { objectKey: null, rollback: null, previous: args.currentKey };
  }
  const upload = await consumeStampUpload(args.businessId, args.uploadId!);
  try {
    const object = await getPrivateObject(upload.objectKey);
    const bytes = await readObjectAtMost(
      object.Body as AsyncIterable<Uint8Array>,
      MAX_LOGO_BYTES,
    );
    const variants = await normalizeImage(bytes);
    const prefix = stampObjectPrefix(
      args.businessId,
      args.programId,
      randomUUID(),
    );
    await putStampVariants(prefix, variants.webp, variants.png);
    return { objectKey: prefix, rollback: prefix, previous: args.currentKey };
  } catch (error) {
    if (error instanceof LoyaltyError) throw error;
    if (error instanceof AssetImageError)
      throw new LoyaltyError(error.status, error.message);
    throw new LoyaltyError(422, "No pudimos procesar esa imagen como sello.");
  } finally {
    await deleteObjectKeys([upload.objectKey]).catch(() => undefined);
    await getDb()
      .delete(loyaltyAssetUploads)
      .where(eq(loyaltyAssetUploads.id, upload.id));
  }
}

async function enqueueStampCleanup(businessId: string, objectPrefix: string) {
  await getDb()
    .insert(loyaltyAssetCleanups)
    .values({ businessId, objectPrefix })
    .onConflictDoNothing();
}

/** Deletes a stamp R2 prefix now; on failure queues it for the idempotent cron retry. */
export async function cleanupStampPrefixNow(
  businessId: string,
  prefix: string,
) {
  try {
    await deleteStampPrefix(prefix);
    await getDb()
      .delete(loyaltyAssetCleanups)
      .where(eq(loyaltyAssetCleanups.objectPrefix, prefix));
  } catch {
    await enqueueStampCleanup(businessId, prefix).catch(() => undefined);
  }
}

export async function cleanupExpiredLoyaltyAssets() {
  const now = new Date();
  const expiredUploads = await getDb()
    .select()
    .from(loyaltyAssetUploads)
    .where(lt(loyaltyAssetUploads.expiresAt, now))
    .limit(100);
  for (const upload of expiredUploads) {
    try {
      await deleteObjectKeys([upload.objectKey]);
      await getDb()
        .delete(loyaltyAssetUploads)
        .where(eq(loyaltyAssetUploads.id, upload.id));
    } catch {
      // Retain metadata so this object remains eligible for the next cron run.
    }
  }
  const cleanups = await getDb()
    .select()
    .from(loyaltyAssetCleanups)
    .where(lt(loyaltyAssetCleanups.notBefore, now))
    .orderBy(asc(loyaltyAssetCleanups.createdAt))
    .limit(100);
  for (const cleanup of cleanups) {
    try {
      await deleteStampPrefix(cleanup.objectPrefix);
      await getDb()
        .delete(loyaltyAssetCleanups)
        .where(eq(loyaltyAssetCleanups.id, cleanup.id));
    } catch (error) {
      const attempts = cleanup.attemptCount + 1;
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
      await getDb()
        .update(loyaltyAssetCleanups)
        .set({
          attemptCount: attempts,
          notBefore: new Date(Date.now() + delayMinutes * 60 * 1000),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "R2 cleanup failed",
        })
        .where(eq(loyaltyAssetCleanups.id, cleanup.id));
    }
  }
  return {
    expiredUploads: expiredUploads.length,
    cleanupJobs: cleanups.length,
  };
}

/** Public read: resolves a program's current stamp prefix if the version matches. */
export async function stampForPublicProgram(
  businessId: string,
  programId: string,
  version: unknown,
) {
  if (
    !uuidPattern.test(businessId) ||
    !uuidPattern.test(programId) ||
    !/^[0-9]+$/.test(String(version))
  ) {
    return null;
  }
  const [program] = await getDb()
    .select({
      stampImageObjectKey: loyaltyPrograms.stampImageObjectKey,
      stampImageVersion: loyaltyPrograms.stampImageVersion,
    })
    .from(loyaltyPrograms)
    .where(
      and(
        eq(loyaltyPrograms.id, programId),
        eq(loyaltyPrograms.businessId, businessId),
      ),
    )
    .limit(1);
  if (
    !program?.stampImageObjectKey ||
    program.stampImageVersion !== Number(version)
  ) {
    return null;
  }
  return program;
}
