import { and, eq, exists, or } from "drizzle-orm";
import { productLocations, products } from "@mi-pasaporte/db/schema";
import { getDb } from "@mi-pasaporte/db";

/** The same local visibility rule is used to paint and to grant a product. */
export function availableAtCounter(locationId: string | null) {
  if (!locationId) return eq(products.availableAllLocations, true);
  return or(
    eq(products.availableAllLocations, true),
    exists(
      getDb()
        .select({ productId: productLocations.productId })
        .from(productLocations)
        .where(
          and(
            eq(productLocations.productId, products.id),
            eq(productLocations.locationId, locationId),
          ),
        ),
    ),
  );
}
