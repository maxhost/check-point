import { randomUUID } from "node:crypto";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  brandAssetCleanups,
  brandAssetUploads,
  businesses,
  memberships,
} from "./schema";
import {
  deleteLogoPrefix,
  deleteObjectKeys,
  getPrivateObject,
  logoObjectPrefix,
  logoTemporaryObjectKey,
  MAX_LOGO_BYTES,
  putLogoVariants,
  readObjectAtMost,
} from "./r2";
import { isIanaTimezone } from "./timezone";

const colorPattern = /^#[0-9a-fA-F]{6}$/;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type LogoAction = "keep" | "replace" | "remove";
export type BrandRecord = {
  id: string;
  name: string;
  timezone: string;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  logoObjectKey: string | null;
  brandRevision: number;
  logoVersion: number;
};

export class BrandError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function nonEmpty(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BrandError(422, `${field} es obligatorio.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > 120) {
    throw new BrandError(422, `${field} no puede superar 120 caracteres.`);
  }
  return normalized;
}

function color(value: unknown, field: string) {
  if (typeof value !== "string" || !colorPattern.test(value)) {
    throw new BrandError(422, `${field} debe ser un color hexadecimal válido.`);
  }
  return value.toUpperCase();
}

export async function ownerBusiness(
  userId: string,
): Promise<BrandRecord | null> {
  const [business] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      timezone: businesses.timezone,
      brandPrimaryColor: businesses.brandPrimaryColor,
      brandComplementaryColor: businesses.brandComplementaryColor,
      brandAccentColor: businesses.brandAccentColor,
      logoObjectKey: businesses.logoObjectKey,
      brandRevision: businesses.brandRevision,
      logoVersion: businesses.logoVersion,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}

export async function createLogoUpload(userId: string, value: unknown) {
  const business = await ownerBusiness(userId);
  if (!business) throw new BrandError(403, "No tienes un negocio como owner.");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrandError(422, "La carga no es válida.");
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.contentType !== "string" ||
    !imageTypes.has(input.contentType)
  ) {
    throw new BrandError(422, "El logo debe ser PNG, JPEG o WebP.");
  }
  if (
    !Number.isInteger(input.byteSize) ||
    Number(input.byteSize) < 1 ||
    Number(input.byteSize) > MAX_LOGO_BYTES
  ) {
    throw new BrandError(422, "El logo debe pesar como máximo 5 MB.");
  }
  const id = randomUUID();
  const objectKey = logoTemporaryObjectKey(business.id, id);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await getDb()
    .insert(brandAssetUploads)
    .values({
      id,
      businessId: business.id,
      objectKey,
      contentType: input.contentType,
      byteSize: Number(input.byteSize),
      expiresAt,
    });
  try {
    const { createTemporaryUploadUrl } = await import("./r2");
    const uploadUrl = await createTemporaryUploadUrl({
      objectKey,
      contentType: input.contentType as
        | "image/jpeg"
        | "image/png"
        | "image/webp",
      byteSize: Number(input.byteSize),
    });
    return { uploadId: id, uploadUrl, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    await getDb().delete(brandAssetUploads).where(eq(brandAssetUploads.id, id));
    throw error;
  }
}

export function validateBrandInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BrandError(422, "Los datos de marca no son válidos.");
  }
  const input = value as Record<string, unknown>;
  const logoAction = input.logoAction;
  if (
    logoAction !== "keep" &&
    logoAction !== "replace" &&
    logoAction !== "remove"
  ) {
    throw new BrandError(422, "La acción del logo no es válida.");
  }
  if (!Number.isInteger(input.revision) || Number(input.revision) < 1) {
    throw new BrandError(422, "La revisión de marca no es válida.");
  }
  const uploadId = input.uploadId;
  if (logoAction === "replace" && (typeof uploadId !== "string" || !uploadId)) {
    throw new BrandError(422, "Selecciona un logo válido antes de guardar.");
  }
  if (logoAction !== "replace" && uploadId !== undefined) {
    throw new BrandError(422, "La carga de logo no corresponde a esta acción.");
  }
  const timezone = nonEmpty(input.timezone, "La zona horaria");
  if (!isIanaTimezone(timezone))
    throw new BrandError(422, "La zona horaria no es válida.");
  return {
    name: nonEmpty(input.name, "El nombre"),
    timezone,
    brandPrimaryColor: color(input.brandPrimaryColor, "El color primario"),
    brandComplementaryColor: color(
      input.brandComplementaryColor,
      "El color complementario",
    ),
    brandAccentColor: color(input.brandAccentColor, "El color de acento"),
    revision: Number(input.revision),
    logoAction: logoAction as LogoAction,
    uploadId: uploadId as string | undefined,
  };
}

async function consumeUpload(businessId: string, uploadId: string) {
  const [upload] = await getDb()
    .update(brandAssetUploads)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(brandAssetUploads.id, uploadId),
        eq(brandAssetUploads.businessId, businessId),
        sql`${brandAssetUploads.consumedAt} is null`,
        sql`${brandAssetUploads.expiresAt} > now()`,
      ),
    )
    .returning();
  if (!upload)
    throw new BrandError(
      409,
      "Esta carga expiró o ya fue utilizada. Selecciona el logo nuevamente.",
    );
  return upload;
}

export async function normalizeLogo(input: Buffer) {
  try {
    // sharp validates the real binary format; the Content-Type supplied by a browser is never trusted.
    const sharp = (await import("sharp")).default;
    const transformer = sharp(input, {
      limitInputPixels: 2048 * 2048,
      failOn: "error",
    }).rotate();
    const metadata = await transformer.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format)
    ) {
      throw new BrandError(
        422,
        "El archivo no es una imagen PNG, JPEG o WebP válida.",
      );
    }
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > 2048 ||
      metadata.height > 2048
    ) {
      throw new BrandError(
        422,
        "El logo no puede superar 2048 × 2048 píxeles.",
      );
    }
    const resized = transformer.resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    });
    const [webp, png] = await Promise.all([
      resized.clone().webp({ quality: 82, effort: 4 }).toBuffer(),
      resized
        .clone()
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer(),
    ]);
    return { webp, png };
  } catch (error) {
    if (error instanceof BrandError) throw error;
    throw new BrandError(
      422,
      "El archivo no es una imagen PNG, JPEG o WebP válida.",
    );
  }
}

async function enqueueCleanup(businessId: string, objectPrefix: string) {
  await getDb()
    .insert(brandAssetCleanups)
    .values({ businessId, objectPrefix })
    .onConflictDoNothing();
}

async function cleanupPrefixNow(businessId: string, prefix: string) {
  try {
    await deleteLogoPrefix(prefix);
    await getDb()
      .delete(brandAssetCleanups)
      .where(eq(brandAssetCleanups.objectPrefix, prefix));
  } catch {
    await enqueueCleanup(businessId, prefix).catch(() => undefined);
  }
}

export async function saveBrand(userId: string, value: unknown) {
  const input = validateBrandInput(value);
  const business = await ownerBusiness(userId);
  if (!business) throw new BrandError(403, "No tienes un negocio como owner.");

  let newPrefix: string | null = null;
  if (input.logoAction === "replace") {
    const upload = await consumeUpload(business.id, input.uploadId!);
    try {
      const object = await getPrivateObject(upload.objectKey);
      const bytes = await readObjectAtMost(
        object.Body as AsyncIterable<Uint8Array>,
        MAX_LOGO_BYTES,
      );
      const variants = await normalizeLogo(bytes);
      newPrefix = logoObjectPrefix(business.id, randomUUID());
      await putLogoVariants(newPrefix, variants.webp, variants.png);
    } catch (error) {
      if (newPrefix) await cleanupPrefixNow(business.id, newPrefix);
      if (error instanceof BrandError) throw error;
      throw new BrandError(422, "No pudimos procesar ese archivo como logo.");
    } finally {
      await deleteObjectKeys([upload.objectKey]).catch(() => undefined);
      await getDb()
        .delete(brandAssetUploads)
        .where(eq(brandAssetUploads.id, upload.id));
    }
  }

  const previousPrefix = business.logoObjectKey;
  const logoChanged = input.logoAction !== "keep";
  const nextLogoKey =
    input.logoAction === "replace"
      ? newPrefix
      : input.logoAction === "remove"
        ? null
        : business.logoObjectKey;
  const [saved] = await getDb()
    .update(businesses)
    .set({
      name: input.name,
      timezone: input.timezone,
      brandPrimaryColor: input.brandPrimaryColor,
      brandComplementaryColor: input.brandComplementaryColor,
      brandAccentColor: input.brandAccentColor,
      logoObjectKey: nextLogoKey,
      brandRevision: sql`${businesses.brandRevision} + 1`,
      logoVersion: logoChanged
        ? sql`${businesses.logoVersion} + 1`
        : businesses.logoVersion,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(businesses.id, business.id),
        eq(businesses.brandRevision, input.revision),
      ),
    )
    .returning({
      id: businesses.id,
      name: businesses.name,
      timezone: businesses.timezone,
      brandPrimaryColor: businesses.brandPrimaryColor,
      brandComplementaryColor: businesses.brandComplementaryColor,
      brandAccentColor: businesses.brandAccentColor,
      logoObjectKey: businesses.logoObjectKey,
      brandRevision: businesses.brandRevision,
      logoVersion: businesses.logoVersion,
    });
  if (!saved) {
    if (newPrefix) await cleanupPrefixNow(business.id, newPrefix);
    throw new BrandError(
      409,
      "La marca cambió en otra sesión. Recarga la página antes de guardar.",
    );
  }
  if (logoChanged && previousPrefix) {
    await cleanupPrefixNow(business.id, previousPrefix);
  }
  return saved;
}

export async function logoForPublicBusiness(
  businessId: string,
  version: unknown,
) {
  if (!/^[0-9a-f-]{36}$/i.test(businessId) || !/^[0-9]+$/.test(String(version)))
    return null;
  const [business] = await getDb()
    .select({
      logoObjectKey: businesses.logoObjectKey,
      logoVersion: businesses.logoVersion,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!business?.logoObjectKey || business.logoVersion !== Number(version))
    return null;
  return business;
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
