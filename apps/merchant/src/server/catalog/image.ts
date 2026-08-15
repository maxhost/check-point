import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { productAssetUploads, products } from "../schema";
import { AssetImageError, normalizeImage } from "../assets/image";
import {
  MAX_LOGO_BYTES,
  deleteObjectKeys,
  getPrivateObject,
  productObjectPrefix,
  productTemporaryObjectKey,
  putProductVariants,
  readObjectAtMost,
} from "../r2";
import { CatalogError, imageTypes, uuidPattern } from "./core";

/** Prepares a signed R2 upload for a product image; the id travels with the product save. */
export async function createProductUpload(businessId: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogError(422, "La carga no es válida.");
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.contentType !== "string" ||
    !imageTypes.has(input.contentType)
  ) {
    throw new CatalogError(422, "La imagen debe ser PNG, JPEG o WebP.");
  }
  if (
    !Number.isInteger(input.byteSize) ||
    Number(input.byteSize) < 1 ||
    Number(input.byteSize) > MAX_LOGO_BYTES
  ) {
    throw new CatalogError(422, "La imagen debe pesar como máximo 5 MB.");
  }
  const id = randomUUID();
  const objectKey = productTemporaryObjectKey(businessId, id);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await getDb()
    .insert(productAssetUploads)
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
      contentType: input.contentType as
        | "image/jpeg"
        | "image/png"
        | "image/webp",
      byteSize: Number(input.byteSize),
    });
    return { uploadId: id, uploadUrl, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    await getDb()
      .delete(productAssetUploads)
      .where(eq(productAssetUploads.id, id));
    throw error;
  }
}

async function consumeProductUpload(businessId: string, uploadId: string) {
  const [upload] = await getDb()
    .update(productAssetUploads)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(productAssetUploads.id, uploadId),
        eq(productAssetUploads.businessId, businessId),
        sql`${productAssetUploads.consumedAt} is null`,
        sql`${productAssetUploads.expiresAt} > now()`,
      ),
    )
    .returning();
  if (!upload) {
    throw new CatalogError(
      409,
      "Esta carga de imagen expiró o ya fue utilizada. Selecciónala de nuevo.",
    );
  }
  return upload;
}

/**
 * Processes a consumed upload (alpha preserved) and stores the WebP/PNG variants under a
 * fresh prefix. Returns the new R2 prefix; the caller rolls it back if the DB write fails.
 */
export async function resolveProductImageUpload(args: {
  businessId: string;
  uploadId: string;
}): Promise<string> {
  const upload = await consumeProductUpload(args.businessId, args.uploadId);
  try {
    const object = await getPrivateObject(upload.objectKey);
    const bytes = await readObjectAtMost(
      object.Body as AsyncIterable<Uint8Array>,
      MAX_LOGO_BYTES,
    );
    const variants = await normalizeImage(bytes);
    const prefix = productObjectPrefix(args.businessId, randomUUID());
    await putProductVariants(prefix, variants.webp, variants.png);
    return prefix;
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    if (error instanceof AssetImageError)
      throw new CatalogError(error.status, error.message);
    throw new CatalogError(422, "No pudimos procesar esa imagen.");
  } finally {
    await deleteObjectKeys([upload.objectKey]).catch(() => undefined);
    await getDb()
      .delete(productAssetUploads)
      .where(eq(productAssetUploads.id, upload.id));
  }
}

/** Public read: resolves a product's current image prefix if the version matches. */
export async function productImageForPublic(
  productId: string,
  version: unknown,
) {
  if (!uuidPattern.test(productId) || !/^[0-9]+$/.test(String(version))) {
    return null;
  }
  const [product] = await getDb()
    .select({
      imageObjectKey: products.imageObjectKey,
      imageVersion: products.imageVersion,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product?.imageObjectKey || product.imageVersion !== Number(version)) {
    return null;
  }
  return product;
}
