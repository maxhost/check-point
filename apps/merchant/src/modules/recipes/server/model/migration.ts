import { createHash, randomUUID } from "node:crypto";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  products,
  productCategories,
  recipeLines,
  stockItems,
  recipeEntities,
  independentRecipeLines,
  independentRecipeRevisions,
  recipeMigrationMappings,
  productCompositions,
  compositionRevisions,
  moduleResourceVersions,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { lockRecipes } from "./common";
import { publishResolution } from "./publication";
import { comparePreservedR1, inventoryR1, preservedR1 } from "./preflight";
import { verifyMigratedR1 } from "./migration-compare";

async function sourceRows(tx: DbTransaction) {
  return tx
    .select({
      product: products,
      categoryName: productCategories.name,
      itemId: recipeLines.itemId,
      quantity: recipeLines.quantity,
      position: recipeLines.position,
      itemName: stockItems.name,
      unit: stockItems.unit,
    })
    .from(recipeLines)
    .innerJoin(
      products,
      and(
        eq(products.businessId, recipeLines.businessId),
        eq(products.id, recipeLines.productId),
      ),
    )
    .innerJoin(
      stockItems,
      and(
        eq(stockItems.businessId, recipeLines.businessId),
        eq(stockItems.id, recipeLines.itemId),
      ),
    )
    .leftJoin(
      productCategories,
      and(
        eq(productCategories.businessId, products.businessId),
        eq(productCategories.id, products.categoryId),
      ),
    )
    .orderBy(
      products.businessId,
      products.id,
      recipeLines.position,
      recipeLines.id,
    );
}
export async function preflightR1(tx: DbTransaction) {
  const result = await tx.execute(
    sql`with catalog as (select business_id,lower(btrim(name)) as normalized,count(*)::int as count from core.product group by business_id,lower(btrim(name))), configured as (select p.business_id,lower(btrim(p.name)) as normalized,count(*)::int as count from core.product p where exists(select 1 from recipes.line l where l.business_id=p.business_id and l.product_id=p.id) group by p.business_id,lower(btrim(p.name))) select 'catalog' as scope,count(*)::int as groups,coalesce(sum(count),0)::int as products from catalog where count>1 union all select 'recipes',count(*)::int,coalesce(sum(count),0)::int from configured where count>1`,
  );
  const rows = await sourceRows(tx);
  return {
    duplicates: result.rows as unknown as {
      scope: string;
      groups: number;
      products: number;
    }[],
    productsWithRecipes: new Set(rows.map((r) => r.product.id)).size,
    ingredientLines: rows.length,
    inventory: await inventoryR1(tx),
    preserved: await preservedR1(tx),
  };
}
/** Caller must establish a real writer cut; this explicit argument is never inferred by deployment. */
export async function cutoverR1(
  tx: DbTransaction,
  options: { writersDrained: true },
) {
  if (options.writersDrained !== true)
    throw new Error("R1 requires a verified old-writer cut");
  const before = await preflightR1(tx),
    rows = await sourceRows(tx);
  const businesses = [...new Set(rows.map((r) => r.product.businessId))].sort();
  for (const businessId of businesses) await lockRecipes(tx, businessId);
  await tx.execute(
    sql`drop trigger if exists recipes_bridge_revision on recipes.line`,
  );
  const catalog = await tx
    .select({ businessId: products.businessId, name: products.name })
    .from(products);
  const current = await tx.select().from(recipeEntities);
  const mappings = await tx.select().from(recipeMigrationMappings);
  const mapped = new Set(mappings.map((m) => m.productId));
  const configured = new Set(
    (
      await tx
        .select({ id: productCompositions.productId })
        .from(productCompositions)
    ).map((r) => r.id),
  );
  const normalize = async (name: string) => {
    const result = await tx.execute(sql`select lower(btrim(${name})) as value`);
    return String(result.rows[0].value);
  };
  const reserved = new Map<string, Set<string>>(),
    occupied = new Map<string, Set<string>>();
  for (const row of catalog) {
    const set = reserved.get(row.businessId) ?? new Set<string>();
    set.add(await normalize(row.name));
    reserved.set(row.businessId, set);
  }
  for (const row of current.filter((r) => r.status === "active")) {
    const set = occupied.get(row.businessId) ?? new Set<string>();
    set.add(await normalize(row.name));
    occupied.set(row.businessId, set);
  }
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = groups.get(row.product.id) ?? [];
    group.push(row);
    groups.set(row.product.id, group);
  }
  const migratedProducts: string[] = [];
  for (const [productId, lines] of groups) {
    if (mapped.has(productId) || configured.has(productId)) continue;
    const { product, categoryName } = lines[0],
      businessId = product.businessId;
    const originalName = product.name.trim(),
      key = await normalize(originalName);
    const taken = occupied.get(businessId) ?? new Set<string>(),
      originals = reserved.get(businessId)!;
    let assignedName = originalName,
      reason = "original";
    if (taken.has(key)) {
      reason = categoryName
        ? "duplicate_name_category"
        : "duplicate_name_suffix";
      let number = categoryName ? 1 : 2;
      for (;;) {
        const suffix = categoryName
          ? ` (${categoryName})${number > 1 ? ` (${number})` : ""}`
          : ` (${number})`;
        assignedName =
          [...originalName]
            .slice(0, 120 - [...suffix].length)
            .join("")
            .trimEnd() + suffix;
        const candidate = await normalize(assignedName);
        if (!taken.has(candidate) && !originals.has(candidate)) break;
        number++;
      }
    }
    taken.add(await normalize(assignedName));
    occupied.set(businessId, taken);
    const recipeId = randomUUID(),
      revisionId = randomUUID();
    const frozen = lines.map((l) => ({
      itemId: l.itemId,
      itemName: l.itemName,
      unit: l.unit,
      quantity: l.quantity,
    }));
    await tx
      .insert(recipeEntities)
      .values({ id: recipeId, businessId, name: assignedName, revisionId });
    await tx.insert(independentRecipeRevisions).values({
      id: revisionId,
      businessId,
      recipeId,
      name: assignedName,
      lines: frozen,
    });
    await tx.insert(independentRecipeLines).values(
      frozen.map((l, position) => ({
        businessId,
        recipeId,
        itemId: l.itemId,
        quantity: l.quantity,
        position,
      })),
    );
    const [revision] = await tx
      .insert(compositionRevisions)
      .values({
        businessId,
        productId,
        productNameAtComposition: product.name,
        isCombo: false,
        recipes: [{ recipeId, quantity: "1.000", position: 0 }],
      })
      .returning();
    await publishResolution(tx, businessId, revision);
    await tx
      .delete(moduleResourceVersions)
      .where(
        and(
          eq(moduleResourceVersions.businessId, businessId),
          eq(moduleResourceVersions.resourceType, "product"),
          eq(moduleResourceVersions.resourceId, productId),
          eq(moduleResourceVersions.providerId, "recipes"),
          eq(moduleResourceVersions.slot, "recipe"),
        ),
      );
    await tx.insert(recipeMigrationMappings).values({
      businessId,
      productId,
      recipeId,
      originalName,
      categoryName,
      assignedName,
      reason,
      sourceFingerprint: createHash("sha256")
        .update(JSON.stringify({ product, categoryName, frozen }))
        .digest("hex"),
    });
    migratedProducts.push(productId);
  }
  const equivalentProducts = await verifyMigratedR1(
    tx,
    migratedProducts,
    rows.map((r) => ({
      businessId: r.product.businessId,
      productId: r.product.id,
      itemId: r.itemId,
      quantity: r.quantity,
      unit: r.unit,
    })),
  );
  const after = await preflightR1(tx);
  const comparison = comparePreservedR1(before.preserved, after.preserved);
  if (!comparison.unchanged) {
    const error = new Error(
      `R1 changed preserved data: ${comparison.changed.join(", ")}`,
    );
    error.name = "R1PreservationError";
    throw error;
  }
  return {
    ...before,
    migrated: migratedProducts.length,
    equivalentProducts,
    after,
    comparison,
  };
}
