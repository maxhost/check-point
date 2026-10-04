import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  orderItems,
  orders,
  productCategories,
  products,
} from "@mi-pasaporte/db/schema";
import { availableAtCounter } from "./catalog-visibility";
import { personalPicks } from "./personal-picks";

/**
 * The CATALOG side of the scan (spec 0030 / 0055): the lean catalog of the detailed sale and
 * the consumer's purchase shortcuts. Apart from `resolve.ts` for its size budget (spec 0148).
 */

/** Lean catalog for the detailed-sale cart: id, name, unit price, image path. */
export async function businessCatalog(
  businessId: string,
  locationId: string | null,
) {
  const rows = await getDb()
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      unitPrice: products.unitPrice,
      imageObjectKey: products.imageObjectKey,
      imageVersion: products.imageVersion,
    })
    .from(products)
    .where(
      and(eq(products.businessId, businessId), availableAtCounter(locationId)),
    )
    .orderBy(asc(products.name));
  const categories = await getDb()
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.businessId, businessId))
    .orderBy(asc(productCategories.name));
  return {
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      unitPrice: p.unitPrice === null ? null : Number(p.unitPrice),
      imagePath: p.imageObjectKey
        ? `/api/public/catalog/${p.id}/image?v=${p.imageVersion}`
        : null,
    })),
    categories,
  };
}

export async function purchaseShortcuts(
  businessId: string,
  consumerId: string,
  locationId: string | null,
  catalog: Awaited<ReturnType<typeof businessCatalog>>,
) {
  const empty = {
    habitualProductIds: [] as string[],
    lastPurchase: null as {
      items: { productId: string; quantity: number }[];
    } | null,
  };
  if (!locationId) return empty;
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recent = await getDb()
    .select({ id: orders.id, createdAt: orders.createdAt })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        eq(orders.consumerId, consumerId),
        eq(orders.locationId, locationId),
        eq(orders.mode, "detailed"),
        gte(orders.createdAt, cutoff),
      ),
    )
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(20);
  if (recent.length === 0) return empty;
  const lines = await getDb()
    .select({
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        recent.map((order) => order.id),
      ),
    );
  return personalPicks(recent, lines, catalog.products);
}
