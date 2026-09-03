import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { brandAssetUploads, businesses, memberships } from "./schema";
import {
  deleteObjectKeys,
  getPrivateObject,
  logoObjectPrefix,
  logoTemporaryObjectKey,
  MAX_LOGO_BYTES,
  putLogoVariants,
  readObjectAtMost,
} from "./r2";
import {
  AssetImageError,
  MAX_INPUT_PIXELS_CROPPED,
  MAX_INPUT_PIXELS_FALLBACK,
  normalizeImage,
} from "./assets/image";
import { ACCEPTED_IMAGE_LABEL } from "../lib/image-formats";
import { BrandError, type BrandRecord, imageTypes } from "./brand/core";
import { validateBrandInput } from "./brand/validation";
import { cleanupPrefixNow } from "./brand/cleanup";

export { BrandError } from "./brand/core";
export type { BrandRecord } from "./brand/core";
export { validateBrandInput } from "./brand/validation";
export { cleanupExpiredBrandAssets } from "./brand/cleanup";
export { normalizeImage } from "./assets/image";

export async function ownerBusiness(
  userId: string,
): Promise<BrandRecord | null> {
  const [business] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      timezone: businesses.timezone,
      currencyCode: businesses.currencyCode,
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
    throw new BrandError(422, `El logo debe ser ${ACCEPTED_IMAGE_LABEL}.`);
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
      contentType: input.contentType,
      byteSize: Number(input.byteSize),
    });
    return { uploadId: id, uploadUrl, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    await getDb().delete(brandAssetUploads).where(eq(brandAssetUploads.id, id));
    throw error;
  }
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
      const variants = await normalizeImage(bytes, {
        maxInputPixels: input.cropped
          ? MAX_INPUT_PIXELS_CROPPED
          : MAX_INPUT_PIXELS_FALLBACK,
      });
      newPrefix = logoObjectPrefix(business.id, randomUUID());
      await putLogoVariants(newPrefix, variants.webp, variants.png);
    } catch (error) {
      if (newPrefix) await cleanupPrefixNow(business.id, newPrefix);
      if (error instanceof BrandError) throw error;
      if (error instanceof AssetImageError)
        throw new BrandError(error.status, error.message);
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
      currencyCode: input.currencyCode ?? businesses.currencyCode,
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
      currencyCode: businesses.currencyCode,
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
  // Strict UUID: a regex-valid-but-not-a-uuid id would make Postgres throw 22P02.
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(businessId) || !/^[0-9]+$/.test(String(version))) return null;
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
