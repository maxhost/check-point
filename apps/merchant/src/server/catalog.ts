import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { businesses } from "./schema";
import type { OwnerBusiness } from "./catalog/core";
import { validateCurrencyCode } from "./catalog/validation";

export { CatalogError } from "./catalog/core";
export type { OwnerBusiness, ProductDTO } from "./catalog/core";
export { ownerBusiness } from "./catalog/core";
export { createProductUpload, productImageForPublic } from "./catalog/image";
export { cleanupExpiredCatalogAssets } from "./catalog/cleanup";
export {
  listCatalog,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./catalog/products";
export {
  createCategory,
  renameCategory,
  deleteCategory,
} from "./catalog/categories";

/** One editable ISO 4217 currency per business (default derived from country). */
export async function updateCurrency(business: OwnerBusiness, value: unknown) {
  const currencyCode = validateCurrencyCode(value);
  await getDb()
    .update(businesses)
    .set({ currencyCode, updatedAt: new Date() })
    .where(eq(businesses.id, business.id));
  return { currencyCode };
}
