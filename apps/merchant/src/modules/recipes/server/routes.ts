import { NextResponse } from "next/server";
import { listLocations } from "../../stock/local";
import { readModuleBody } from "../../errors";
import type { ModuleRoute } from "../../route-table";
import { buildRecipeDraft, buildRecipePhotoDraft } from "../draft";
import {
  archiveRecipe,
  createRecipe,
  listLibrary,
  listMigrationRenames,
  listRecipeRevisions,
  readLibraryRecipe,
  updateRecipe,
} from "./library";
import {
  listCompositionRevisions,
  listProducts,
  previewComposition,
  readComposition,
  saveComposition,
} from "./compositions";
export { eventSubscriptions } from "./consumption";

const query = (request: Request) => new URL(request.url).searchParams;

/** SPEC0232: identities live in /library; products only own a composition.
 * The dispatcher applies the recipes grant and module/dependency guards. */
export const routes: readonly ModuleRoute[] = [
  {
    // Generic module roots reserve PUT for activation and otherwise default to405.
    // Keep the removed product listing explicitly404 without core exceptions.
    method: "GET",
    path: "",
    failure: "Esa ruta no existe.",
    handler: async () =>
      NextResponse.json(
        { error: "Esa ruta no existe.", code: "route_not_found" },
        { status: 404 },
      ),
  },
  {
    method: "GET",
    path: "locations",
    failure: "No pudimos leer los locales.",
    handler: async ({ business }) =>
      NextResponse.json(await listLocations(business.id)),
  },
  {
    method: "GET",
    path: "library",
    failure: "No pudimos leer las recetas.",
    handler: async ({ business, request }) =>
      NextResponse.json(await listLibrary(business.id, query(request))),
  },
  {
    method: "POST",
    path: "library",
    failure: "No pudimos crear la receta.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        {
          recipe: await createRecipe(
            business.id,
            await readModuleBody(request),
          ),
        },
        { status: 201 },
      ),
  },
  {
    method: "GET",
    path: "library/:recipeId",
    failure: "No pudimos leer la receta.",
    handler: async ({ business, params }) =>
      NextResponse.json({
        recipe: await readLibraryRecipe(business.id, params.recipeId),
      }),
  },
  {
    method: "PUT",
    path: "library/:recipeId",
    failure: "No pudimos guardar la receta.",
    handler: async ({ business, params, request }) =>
      NextResponse.json({
        recipe: await updateRecipe(
          business.id,
          params.recipeId,
          await readModuleBody(request),
        ),
      }),
  },
  {
    method: "POST",
    path: "library/:recipeId/archive",
    failure: "No pudimos archivar la receta.",
    handler: async ({ business, params, request }) =>
      NextResponse.json({
        recipe: await archiveRecipe(
          business.id,
          params.recipeId,
          await readModuleBody(request),
        ),
      }),
  },
  {
    method: "GET",
    path: "library/:recipeId/revisions",
    failure: "No pudimos leer el historial de la receta.",
    handler: async ({ business, params, request }) =>
      NextResponse.json(
        await listRecipeRevisions(business.id, params.recipeId, query(request)),
      ),
  },
  {
    method: "GET",
    path: "migration-renames",
    failure: "No pudimos leer los nombres actualizados.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        await listMigrationRenames(business.id, query(request)),
      ),
  },
  {
    method: "GET",
    path: "products",
    failure: "No pudimos leer los productos.",
    handler: async ({ business, request }) =>
      NextResponse.json(await listProducts(business.id, query(request))),
  },
  {
    method: "GET",
    path: "products/:productId/composition",
    failure: "No pudimos leer la composición.",
    handler: async ({ business, params }) =>
      NextResponse.json({
        composition: await readComposition(business.id, params.productId),
      }),
  },
  {
    method: "PUT",
    path: "products/:productId/composition",
    failure: "No pudimos guardar la composición.",
    handler: async ({ business, params, request }) =>
      NextResponse.json({
        composition: await saveComposition(
          business.id,
          params.productId,
          await readModuleBody(request),
        ),
      }),
  },
  {
    method: "GET",
    path: "products/:productId/composition/revisions",
    failure: "No pudimos leer el historial de la composición.",
    handler: async ({ business, params, request }) =>
      NextResponse.json(
        await listCompositionRevisions(
          business.id,
          params.productId,
          query(request),
        ),
      ),
  },
  {
    method: "POST",
    path: "products/:productId/composition/preview",
    failure: "No pudimos calcular el descuento de insumos.",
    handler: async ({ business, params, request }) =>
      NextResponse.json({
        preview: await previewComposition(
          business.id,
          params.productId,
          await readModuleBody(request),
        ),
      }),
  },
  {
    method: "POST",
    path: "draft",
    failure: "No pudimos analizar el texto.",
    handler: async ({ business, userId, request }) =>
      NextResponse.json(
        await buildRecipeDraft(
          business.id,
          userId,
          await readModuleBody(request),
        ),
      ),
  },
  {
    method: "POST",
    path: "draft-photo",
    failure: "No pudimos analizar la foto.",
    handler: async ({ business, userId, request }) =>
      NextResponse.json(
        await buildRecipePhotoDraft(business.id, userId, request),
      ),
  },
];
