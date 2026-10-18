import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  products,
  productCompositions,
  compositionRevisions,
  recipeSaleResolutions,
  independentRecipeRevisions,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql, inArray } from "drizzle-orm";
import type { CompositionPreviewDTO, ProductCompositionDTO } from "./contracts";
import {
  compareName,
  expectRevision,
  lockRecipes,
  ownProduct,
  page,
  type Db,
} from "./model/common";
import { parseComposition } from "./model/input";
import {
  publishResolution,
  compositionBasis,
  assertCompositionCapture,
  resolveComponents,
  revisionIngredients,
} from "./model/publication";
import { ModuleError } from "../../errors";
import { expandComposition } from "./model/expand";

async function compositionDTO(
  db: Db,
  businessId: string,
  rawId: unknown,
): Promise<ProductCompositionDTO> {
  const product = await ownProduct(db, businessId, rawId);
  const [current] = await db
    .select({
      revision: compositionRevisions,
      resolution: recipeSaleResolutions,
    })
    .from(productCompositions)
    .innerJoin(
      compositionRevisions,
      and(
        eq(compositionRevisions.id, productCompositions.revisionId),
        eq(compositionRevisions.businessId, businessId),
      ),
    )
    .innerJoin(
      recipeSaleResolutions,
      and(
        eq(recipeSaleResolutions.id, productCompositions.resolutionId),
        eq(recipeSaleResolutions.businessId, businessId),
      ),
    )
    .where(
      and(
        eq(productCompositions.businessId, businessId),
        eq(productCompositions.productId, product.id),
      ),
    );
  if (!current)
    return {
      productId: product.id,
      productName: product.name,
      isCombo: false,
      revisionId: null,
      resolutionId: null,
      recipes: [],
      basisQuantity: "1",
      basisUnit: "unit",
      conversionVersion: "mass-si-1",
    };
  if (current.revision.productId !== product.id)
    throw new Error("Current product composition is inconsistent");
  assertCompositionCapture(current.revision, current.resolution);
  const ids = current.resolution.components.map((c) => c.recipeRevisionId);
  const revisions = ids.length
    ? await db
        .select()
        .from(independentRecipeRevisions)
        .where(
          and(
            eq(independentRecipeRevisions.businessId, businessId),
            inArray(independentRecipeRevisions.id, ids),
          ),
        )
    : [];
  const byId = new Map(revisions.map((r) => [r.id, r]));
  return {
    productId: product.id,
    productName: product.name,
    isCombo: current.revision.isCombo,
    ...compositionBasis(current.revision),
    revisionId: current.revision.id,
    resolutionId: current.resolution.id,
    recipes: current.resolution.components.map((c) => ({
      ...c,
      recipeName: byId.get(c.recipeRevisionId)!.name,
    })),
  };
}
export function readComposition(businessId: string, id: unknown) {
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    return compositionDTO(tx, businessId, id);
  });
}
export async function saveComposition(
  businessId: string,
  id: unknown,
  body: Record<string, unknown>,
) {
  const parsed = parseComposition(body);
  return withDbTransaction(async (tx) => {
    await lockRecipes(tx, businessId);
    const product = await ownProduct(tx, businessId, id);
    const [current] = await tx
      .select()
      .from(productCompositions)
      .where(
        and(
          eq(productCompositions.businessId, businessId),
          eq(productCompositions.productId, product.id),
        ),
      );
    expectRevision(body.expectedRevisionId, current?.revisionId ?? null);
    const basis = await effectiveBasis(tx, businessId, product, parsed);
    const resolved = await resolveComponents(tx, businessId, parsed.recipes);
    const ingredients = await revisionIngredients(
      tx,
      businessId,
      resolved.map((c) => c.recipeRevisionId),
    );
    expandComposition(resolved, ingredients);
    const [revision] = await tx
      .insert(compositionRevisions)
      .values({
        businessId,
        productId: product.id,
        productNameAtComposition: product.name,
        ...parsed,
        ...basis,
      })
      .returning();
    await publishResolution(tx, businessId, revision);
    return compositionDTO(tx, businessId, product.id);
  });
}
export async function previewComposition(
  businessId: string,
  id: unknown,
  body: Record<string, unknown>,
): Promise<CompositionPreviewDTO> {
  const parsed = parseComposition(body);
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    const product = await ownProduct(tx, businessId, id);
    const [current] = await tx
      .select()
      .from(productCompositions)
      .where(
        and(
          eq(productCompositions.businessId, businessId),
          eq(productCompositions.productId, product.id),
        ),
      );
    expectRevision(body.expectedRevisionId, current?.revisionId ?? null);
    const basis = await effectiveBasis(tx, businessId, product, parsed);
    const resolved = await resolveComponents(tx, businessId, parsed.recipes),
      revisions = await revisionIngredients(
        tx,
        businessId,
        resolved.map((c) => c.recipeRevisionId),
      );
    const expanded = expandComposition(resolved, revisions),
      byId = new Map(revisions.map((r) => [r.id, r]));
    return {
      productId: product.id,
      productName: product.name,
      isCombo: parsed.isCombo,
      ...basis,
      compositionRevisionId: current?.revisionId ?? null,
      resolutionId: null,
      components: resolved.map((c) => ({
        ...c,
        recipeName: byId.get(c.recipeRevisionId)!.name,
        ingredients: expanded.sources
          .filter((s) => s.recipeId === c.recipeId)
          .map(
            ({ itemId, itemName, unit, exactQuantity, allocatedQuantity }) => ({
              itemId,
              itemName,
              unit,
              exactQuantity,
              allocatedQuantity,
            }),
          ),
      })),
      ingredients: expanded.ingredients,
      rounding: expanded.rounding,
    };
  });
}
export async function listProducts(businessId: string, query: URLSearchParams) {
  const rows = await getDb()
    .select({ product: products, revision: compositionRevisions })
    .from(products)
    .leftJoin(
      productCompositions,
      and(
        eq(productCompositions.businessId, products.businessId),
        eq(productCompositions.productId, products.id),
      ),
    )
    .leftJoin(
      compositionRevisions,
      and(
        eq(compositionRevisions.businessId, products.businessId),
        eq(compositionRevisions.id, productCompositions.revisionId),
      ),
    )
    .where(eq(products.businessId, businessId));
  const filtered = rows
    .filter((r) =>
      r.product.name
        .toLowerCase()
        .includes((query.get("q") ?? "").toLowerCase()),
    )
    .map(({ product: p, revision: r }) => ({
      id: p.id,
      name: p.name,
      productId: p.id,
      productName: p.name,
      isCombo: r?.isCombo ?? false,
      compositionRevisionId: r?.id ?? null,
    }))
    .sort(compareName);
  const { items, nextCursor } = page(filtered, businessId, "products", query);
  return {
    products: items.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      isCombo: r.isCombo,
      compositionRevisionId: r.compositionRevisionId,
    })),
    nextCursor,
  };
}
export async function listCompositionRevisions(
  businessId: string,
  id: unknown,
  query: URLSearchParams,
) {
  const product = await ownProduct(getDb(), businessId, id);
  const rows = await getDb()
    .select()
    .from(compositionRevisions)
    .where(
      and(
        eq(compositionRevisions.businessId, businessId),
        eq(compositionRevisions.productId, product.id),
      ),
    );
  rows.sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );
  const { items, nextCursor } = page(
    rows,
    businessId,
    "composition-revisions/" + product.id,
    query,
  );
  return {
    revisions: items.map((r) => ({
      id: r.id,
      isCombo: r.isCombo,
      productNameAtComposition: r.productNameAtComposition,
      recipes: r.recipes,
      ...compositionBasis(r),
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

async function effectiveBasis(
  db: Db,
  businessId: string,
  product: typeof products.$inferSelect,
  parsed: ReturnType<typeof parseComposition>,
) {
  const current = await compositionDTO(db, businessId, product.id);
  if (parsed.basisQuantity !== undefined && parsed.basisUnit !== undefined)
    return compositionBasis({
      basisQuantity: parsed.basisQuantity,
      basisUnit: parsed.basisUnit,
      conversionVersion: "mass-si-1",
    });
  if (current.revisionId)
    return compositionBasis({
      basisQuantity: current.basisQuantity!,
      basisUnit: current.basisUnit!,
      conversionVersion: current.conversionVersion!,
    });
  if (product.soldByWeight)
    throw new ModuleError(
      409,
      "measurement_basis_required",
      "Define la base de composición del producto.",
    );
  return {
    basisQuantity: "1",
    basisUnit: "unit",
    conversionVersion: "mass-si-1",
  } as const;
}
