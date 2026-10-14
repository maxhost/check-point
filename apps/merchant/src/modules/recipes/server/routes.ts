import { listLocations } from "../../stock/local";
export { eventSubscriptions } from "./consumption";
import { NextResponse } from "next/server";
import { readModuleBody } from "../../errors";
import type { ModuleRoute } from "../../route-table";
import { listRecipes, readRecipe, saveRecipe } from "../recipes";
import { buildRecipeDraft, buildRecipePhotoDraft } from "../draft";

/**
 * Spec 0210 / 0214 / 0216 — LA API DE RECETAS, bajo `/api/modules/recipes/…`. Los mismos handlers
 * que vivian en `app/api/modules/recipes/**`, con las mismas URLs, cuerpos y status. El despachador
 * aplica antes el permiso `recipes` y el modulo encendido (que por dependencias implica Stock).
 */
export const routes: readonly ModuleRoute[] = [
  {
    method: "GET",
    path: "locations",
    failure: "No pudimos leer los locales.",
    handler: async ({ business }) =>
      NextResponse.json(await listLocations(business.id)),
  },
  /** Todos los productos con su costo y margen → `200 { recipes }`. */
  {
    method: "GET",
    path: "",
    failure: "No pudimos leer las recetas.",
    handler: async ({ business, request }) =>
      NextResponse.json({
        recipes: await listRecipes(
          business.id,
          new URL(request.url).searchParams.get("locationId"),
        ),
      }),
  },
  /** La receta de un producto con sus lineas → `200 { recipe }`. */
  {
    method: "GET",
    path: ":productId",
    failure: "No pudimos leer la receta.",
    handler: async ({ business, params, request }) =>
      NextResponse.json({
        recipe: await readRecipe(
          business.id,
          params.productId,
          new URL(request.url).searchParams.get("locationId"),
        ),
      }),
  },
  /** `{ lines: [{ itemId, quantity }] }` reemplaza la receta → `200 { recipe }`. */
  {
    method: "PUT",
    path: ":productId",
    failure: "No pudimos guardar la receta.",
    handler: async ({ request, business, params }) =>
      NextResponse.json({
        recipe: await saveRecipe(
          business.id,
          params.productId,
          await readModuleBody(request),
        ),
      }),
  },
  {
    method: "DELETE",
    path: ":productId",
    failure: "No pudimos borrar la receta.",
    handler: async ({ business, params, request }) =>
      NextResponse.json({
        recipe: await saveRecipe(business.id, params.productId, {
          lines: [],
          locationId: new URL(request.url).searchParams.get("locationId"),
        }),
      }),
  },
  /** Spec 0214: el texto dictado → borrador de la receta por unidad. No guarda la receta. */
  {
    method: "POST",
    path: ":productId/draft",
    failure: "No pudimos analizar el texto.",
    handler: async ({ request, business, userId, params }) =>
      NextResponse.json(
        await buildRecipeDraft(
          business.id,
          userId,
          params.productId,
          await readModuleBody(request),
        ),
      ),
  },
  /** Spec 0223: 1 a 3 fotos (multipart `photos`) de la receta → el mismo borrador. */
  {
    method: "POST",
    path: ":productId/draft-photo",
    failure: "No pudimos analizar la foto.",
    handler: async ({ request, business, userId, params }) =>
      NextResponse.json(
        await buildRecipePhotoDraft(
          business.id,
          userId,
          params.productId,
          request,
        ),
      ),
  },
];
