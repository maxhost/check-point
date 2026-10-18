import { hasOpenImport } from "./import-guard";
import {
  assertLegacyProduct,
  publicProduct,
  catalogProductDTO,
  type CatalogOptions,
} from "./measured-contract";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  products,
  productCategories,
  productLocations,
  locations,
} from "@mi-pasaporte/db/schema";
import { ACCEPTED_IMAGE_CONTENT_TYPE_SET } from "../../lib/image-formats";

/**
 * El error del dominio catalogo. **`code` es OPCIONAL y aditivo** (ADR 0086): a diferencia de
 * catalog-import, este dominio no tiene lista cerrada de codigos y la ruta serializa
 * `{ error: message }`. Los errores que no lo pasan siguen respondiendo exactamente igual —
 * `catalogError()` solo agrega la clave `code` cuando existe.
 */
export class CatalogError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly product?: unknown,
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
  soldByWeight?: boolean;
  pricingUnit?: string;
  salesRevision?: number;
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
  assertLegacyProduct(product);
  return {
    ...publicProduct(product),
    unitPrice: product.unitPrice === null ? null : Number(product.unitPrice),
    unitCost: product.unitCost === null ? null : Number(product.unitCost),
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

export const productColumns = {
  soldByWeight: products.soldByWeight,
  pricingUnit: products.pricingUnit,
  salesRevision: products.salesRevision,
  id: products.id,
  name: products.name,
  categoryId: products.categoryId,
  unitPrice: products.unitPrice,
  unitCost: products.unitCost,
  imageObjectKey: products.imageObjectKey,
  imageVersion: products.imageVersion,
  imageSource: products.imageSource,
  imageAuthor: products.imageAuthor,
  imageAuthorUrl: products.imageAuthorUrl,
  imageSourceUrl: products.imageSourceUrl,
  availableAllLocations: products.availableAllLocations,
};

export async function listCatalog(
  business: OwnerBusiness,
  options: CatalogOptions = {},
) {
  const db = getDb();
  const rows = await db
    .select(productColumns)
    .from(products)
    .where(eq(products.businessId, business.id))
    .orderBy(asc(products.name));
  const categories = await db
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.businessId, business.id))
    .orderBy(asc(productCategories.name));
  const locationList = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.businessId, business.id))
    .orderBy(asc(locations.name));

  const restrictedIds = rows
    .filter((row) => !row.availableAllLocations)
    .map((row) => row.id);
  const links = restrictedIds.length
    ? await db
        .select({
          productId: productLocations.productId,
          locationId: productLocations.locationId,
        })
        .from(productLocations)
        .where(inArray(productLocations.productId, restrictedIds))
    : [];
  const byProduct = new Map<string, string[]>();
  for (const link of links) {
    const list = byProduct.get(link.productId) ?? [];
    list.push(link.locationId);
    byProduct.set(link.productId, list);
  }

  return {
    products: rows.map((row) =>
      catalogProductDTO(
        { ...row, locationIds: byProduct.get(row.id) ?? [] },
        options,
      ),
    ),
    categories,
    locations: locationList,
    currencyCode: business.currencyCode,
    // ADR 0086 — un BOOLEANO, y nada mas: la pantalla necesita saber que el alta esta
    // bloqueada, no quien importa ni con que. Ninguna clave interna del import cruza.
    // **No es el guard**, es su reflejo: la proteccion sigue siendo el 409 del servidor.
    importInProgress: await hasOpenImport(business.id),
  };
}
