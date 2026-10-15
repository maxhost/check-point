import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  recipeEntities,
  independentRecipeLines,
  independentRecipeRevisions,
  recipeMigrationMappings,
  stockItems,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ModuleError } from "../../../errors";
import type { LibraryRecipeDTO } from "../contracts";
import { compareName, ownRecipe, page, type Db } from "./common";
export async function recipeDTO(
  db: Db,
  businessId: string,
  rawId: unknown,
): Promise<LibraryRecipeDTO> {
  const recipe = await ownRecipe(db, businessId, rawId);
  const lines = await db
    .select({
      itemId: stockItems.id,
      itemName: stockItems.name,
      itemStatus: stockItems.status,
      unit: stockItems.unit,
      quantity: independentRecipeLines.quantity,
      position: independentRecipeLines.position,
    })
    .from(independentRecipeLines)
    .innerJoin(
      stockItems,
      and(
        eq(stockItems.id, independentRecipeLines.itemId),
        eq(stockItems.businessId, independentRecipeLines.businessId),
      ),
    )
    .where(
      and(
        eq(independentRecipeLines.businessId, businessId),
        eq(independentRecipeLines.recipeId, recipe.id),
      ),
    )
    .orderBy(independentRecipeLines.position);
  return {
    id: recipe.id,
    name: recipe.name,
    status: recipe.status as "active" | "archived",
    revisionId: recipe.revisionId,
    lines: lines.map((l) => ({
      itemId: l.itemId,
      itemName: l.itemName,
      itemStatus: l.itemStatus as "active" | "archived",
      unit: l.unit,
      quantity: l.quantity,
    })),
  };
}
export function readLibraryRecipe(businessId: string, rawId: unknown) {
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    return recipeDTO(tx, businessId, rawId);
  });
}

export async function listLibrary(businessId: string, query: URLSearchParams) {
  const status = query.get("status") ?? "active";
  if (!["active", "archived", "all"].includes(status))
    throw new ModuleError(422, "invalid_body", "Ese estado no es válido.");
  const recipes = await getDb()
    .select()
    .from(recipeEntities)
    .where(
      and(
        eq(recipeEntities.businessId, businessId),
        status === "all" ? undefined : eq(recipeEntities.status, status),
      ),
    );
  const allLines = await getDb()
    .select({ recipeId: independentRecipeLines.recipeId })
    .from(independentRecipeLines)
    .where(eq(independentRecipeLines.businessId, businessId));
  const counts = new Map<string, number>();
  for (const l of allLines)
    counts.set(l.recipeId, (counts.get(l.recipeId) ?? 0) + 1);
  const filtered = recipes
    .filter((r) =>
      r.name.toLowerCase().includes((query.get("q") ?? "").toLowerCase()),
    )
    .sort(compareName)
    .map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      revisionId: r.revisionId,
      lineCount: counts.get(r.id) ?? 0,
    }));
  const { items, nextCursor } = page(filtered, businessId, "library", query);
  return { recipes: items, nextCursor };
}
export async function listRecipeRevisions(
  businessId: string,
  id: unknown,
  query: URLSearchParams,
) {
  const recipe = await ownRecipe(getDb(), businessId, id);
  const rows = await getDb()
    .select()
    .from(independentRecipeRevisions)
    .where(
      and(
        eq(independentRecipeRevisions.businessId, businessId),
        eq(independentRecipeRevisions.recipeId, recipe.id),
      ),
    );
  rows.sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );
  const { items, nextCursor } = page(
    rows,
    businessId,
    "recipe-revisions/" + recipe.id,
    query,
  );
  return {
    revisions: items.map((r) => ({
      id: r.id,
      name: r.name,
      lines: r.lines,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  };
}
export async function listMigrationRenames(
  businessId: string,
  query: URLSearchParams,
) {
  const rows = await getDb()
    .select({
      mapping: recipeMigrationMappings,
      currentRecipeName: recipeEntities.name,
    })
    .from(recipeMigrationMappings)
    .innerJoin(
      recipeEntities,
      and(
        eq(recipeEntities.businessId, recipeMigrationMappings.businessId),
        eq(recipeEntities.id, recipeMigrationMappings.recipeId),
      ),
    )
    .where(eq(recipeMigrationMappings.businessId, businessId));
  const filtered = rows
    .filter((r) => r.mapping.reason !== "original")
    .map(({ mapping: m, currentRecipeName }) => ({
      id: m.productId,
      productId: m.productId,
      recipeId: m.recipeId,
      originalName: m.originalName,
      categoryName: m.categoryName,
      assignedName: m.assignedName,
      reason: m.reason,
      currentRecipeName,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const { items, nextCursor } = page(
    filtered,
    businessId,
    "migration-renames",
    query,
  );
  return {
    renames: items.map((r) => ({
      productId: r.productId,
      recipeId: r.recipeId,
      originalName: r.originalName,
      categoryName: r.categoryName,
      assignedName: r.assignedName,
      reason: r.reason,
      currentRecipeName: r.currentRecipeName,
    })),
    nextCursor,
  };
}
