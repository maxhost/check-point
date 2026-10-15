import { randomUUID } from "node:crypto";
import { withDbTransaction } from "@mi-pasaporte/db";
import {
  recipeEntities,
  independentRecipeLines,
  independentRecipeRevisions,
  productCompositions,
  compositionRevisions,
  products,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import { pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { ModuleError } from "../../errors";
import {
  activeRecipe,
  compareName,
  expectRevision,
  lockRecipes,
  ownRecipe,
} from "./model/common";
import { parseRecipeLines, recipeName } from "./model/input";
import { resolveIngredients } from "./model/ingredients";
import { fanoutRecipe } from "./model/publication";
import { recipeDTO } from "./model/library-read";
export {
  readLibraryRecipe,
  listLibrary,
  listRecipeRevisions,
  listMigrationRenames,
} from "./model/library-read";

async function writeRecipe(
  businessId: string,
  rawId: unknown,
  body: Record<string, unknown>,
  create: boolean,
) {
  const name = recipeName(body.name),
    lines = parseRecipeLines(body);
  try {
    return await withDbTransaction(async (tx) => {
      await lockRecipes(tx, businessId);
      const recipe = create ? null : await ownRecipe(tx, businessId, rawId);
      if (recipe) {
        activeRecipe(recipe.status);
        expectRevision(body.expectedRevisionId, recipe.revisionId);
      }
      const id = recipe?.id ?? randomUUID(),
        revisionId = randomUUID();
      const frozen = await resolveIngredients(tx, businessId, id, lines);
      if (create)
        await tx
          .insert(recipeEntities)
          .values({ id, businessId, name, revisionId });
      else
        await tx
          .update(recipeEntities)
          .set({ name, revisionId })
          .where(
            and(
              eq(recipeEntities.businessId, businessId),
              eq(recipeEntities.id, id),
            ),
          );
      await tx.insert(independentRecipeRevisions).values({
        id: revisionId,
        businessId,
        recipeId: id,
        name,
        lines: frozen,
      });
      await tx
        .delete(independentRecipeLines)
        .where(
          and(
            eq(independentRecipeLines.businessId, businessId),
            eq(independentRecipeLines.recipeId, id),
          ),
        );
      if (frozen.length)
        await tx.insert(independentRecipeLines).values(
          frozen.map((line, position) => ({
            businessId,
            recipeId: id,
            itemId: line.itemId,
            quantity: line.quantity,
            position,
          })),
        );
      await fanoutRecipe(tx, businessId, id);
      return recipeDTO(tx, businessId, id);
    });
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      let nested: unknown = error;
      let constraint = "";
      for (let i = 0; i < 4 && nested && typeof nested === "object"; i++) {
        const e = nested as { constraint?: string; cause?: unknown };
        constraint = e.constraint ?? constraint;
        nested = e.cause;
      }
      const recipe = constraint.includes("recipe_active_name");
      throw new ModuleError(
        409,
        recipe ? "recipe_name_taken" : "item_name_taken",
        recipe
          ? "Ya hay una receta activa con ese nombre."
          : "Ya hay un insumo activo con ese nombre.",
      );
    }
    throw error;
  }
}
export const createRecipe = (
  businessId: string,
  body: Record<string, unknown>,
) => writeRecipe(businessId, null, body, true);
export const updateRecipe = (
  businessId: string,
  id: unknown,
  body: Record<string, unknown>,
) => writeRecipe(businessId, id, body, false);

export async function archiveRecipe(
  businessId: string,
  id: unknown,
  body: Record<string, unknown>,
) {
  return withDbTransaction(async (tx) => {
    await lockRecipes(tx, businessId);
    const recipe = await ownRecipe(tx, businessId, id);
    expectRevision(body.expectedRevisionId, recipe.revisionId);
    const current = await tx
      .select({
        productId: products.id,
        productName: products.name,
        compositionRevisionId: compositionRevisions.id,
        recipes: compositionRevisions.recipes,
      })
      .from(productCompositions)
      .innerJoin(
        products,
        and(
          eq(products.businessId, productCompositions.businessId),
          eq(products.id, productCompositions.productId),
        ),
      )
      .innerJoin(
        compositionRevisions,
        and(
          eq(compositionRevisions.businessId, productCompositions.businessId),
          eq(compositionRevisions.id, productCompositions.revisionId),
        ),
      )
      .where(eq(productCompositions.businessId, businessId));
    const uses = current
      .filter((c) => c.recipes.some((r) => r.recipeId === recipe.id))
      .sort((a, b) =>
        compareName(
          { id: a.productId, name: a.productName },
          { id: b.productId, name: b.productName },
        ),
      )
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        compositionRevisionId: p.compositionRevisionId,
      }));
    if (uses.length)
      throw new ModuleError(409, "recipe_in_use", "Esa receta está en uso.", {
        products: uses,
      });
    await tx
      .update(recipeEntities)
      .set({ status: "archived" })
      .where(
        and(
          eq(recipeEntities.businessId, businessId),
          eq(recipeEntities.id, recipe.id),
        ),
      );
    return recipeDTO(tx, businessId, recipe.id);
  });
}
