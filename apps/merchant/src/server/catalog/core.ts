import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { businesses, memberships } from "../schema";
import { ACCEPTED_IMAGE_CONTENT_TYPE_SET } from "../../lib/image-formats";

export class CatalogError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Re-exported under the historical name; the source of truth lives in `lib/image-formats`. */
export const imageTypes = ACCEPTED_IMAGE_CONTENT_TYPE_SET;
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OwnerBusiness = { id: string; currencyCode: string };

/** Service-side product row, including the internal R2 key the DTO strips. */
export type ProductRecord = {
  id: string;
  name: string;
  categoryId: string | null;
  unitPrice: string | null;
  unitCost: string | null;
  imageObjectKey: string | null;
  imageVersion: number;
  imageSource: string | null;
  imageAuthor: string | null;
  imageAuthorUrl: string | null;
  imageSourceUrl: string | null;
  availableAllLocations: boolean;
  locationIds: string[];
};

export type CategoryRecord = { id: string; name: string };
export type LocationRecord = { id: string; name: string };

/** Client-facing product: never leaks `imageObjectKey`, only a public `imagePath`. */
export type ProductDTO = {
  id: string;
  name: string;
  categoryId: string | null;
  unitPrice: number | null;
  unitCost: number | null;
  imagePath: string | null;
  imageVersion: number;
  imageSource: string | null;
  imageAuthor: string | null;
  imageAuthorUrl: string | null;
  imageSourceUrl: string | null;
  availableAllLocations: boolean;
  locationIds: string[];
};

export function toProductDTO(product: ProductRecord): ProductDTO {
  // Drop the internal R2 key; attribution fields are public and flow through `rest`.
  const { imageObjectKey, unitPrice, unitCost, ...rest } = product;
  return {
    ...rest,
    unitPrice: unitPrice === null ? null : Number(unitPrice),
    unitCost: unitCost === null ? null : Number(unitCost),
    imagePath: imageObjectKey
      ? `/api/public/catalog/${product.id}/image?v=${product.imageVersion}`
      : null,
  };
}

/** Resolves the owner's business (id + currency). Returns null when the user owns none. */
export async function ownerBusiness(
  userId: string,
): Promise<OwnerBusiness | null> {
  const [business] = await getDb()
    .select({ id: businesses.id, currencyCode: businesses.currencyCode })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return business ?? null;
}
