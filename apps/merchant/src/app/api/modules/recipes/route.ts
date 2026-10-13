import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../modules/guard";
import { moduleErrorResponse } from "../../../../modules/errors";
import { listRecipes } from "../../../../modules/recipes/recipes";
import { putModule } from "../../../../modules/toggle-route";

export const dynamic = "force-dynamic";

/** `GET /api/modules/recipes` — spec 0210: todos los productos con su costo y margen. Permiso
 * `catalog` + modulo Recetas (que por la regla de dependencias implica Stock). */
export async function GET(request: Request) {
  const auth = await requireModuleAccess(request, "recipes");
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ recipes: await listRecipes(auth.business.id) });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos leer las recetas.");
  }
}

/** `PUT /api/modules/recipes` — encender/apagar el modulo. Next resuelve esta ruta estatica antes
 * que `[moduleId]`, asi que el toggle del modulo tiene que vivir tambien aca (`toggle-route.ts`). */
export async function PUT(request: Request) {
  return putModule(request, "recipes");
}
