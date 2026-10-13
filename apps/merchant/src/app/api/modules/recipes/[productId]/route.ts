import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../modules/guard";
import {
  moduleErrorResponse,
  readModuleBody,
} from "../../../../../modules/errors";
import { readRecipe, saveRecipe } from "../../../../../modules/recipes/recipes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ productId: string }> };

/** `GET /api/modules/recipes/:productId` → `200 { recipe }` con sus lineas. */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireModuleAccess(request, "recipes");
  if ("response" in auth) return auth.response;
  try {
    const { productId } = await params;
    return NextResponse.json({
      recipe: await readRecipe(auth.business.id, productId),
    });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos leer la receta.");
  }
}

/** `PUT /api/modules/recipes/:productId` — `{ lines: [{ itemId, quantity }] }` reemplaza la receta. */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireModuleAccess(request, "recipes");
  if ("response" in auth) return auth.response;
  try {
    const { productId } = await params;
    const recipe = await saveRecipe(
      auth.business.id,
      productId,
      await readModuleBody(request),
    );
    return NextResponse.json({ recipe });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos guardar la receta.");
  }
}
