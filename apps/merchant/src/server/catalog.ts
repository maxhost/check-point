// Barrel for the product catalog domain. Split by concern to stay within the
// file-size budget; every `from "../catalog"` import resolves here unchanged.
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
