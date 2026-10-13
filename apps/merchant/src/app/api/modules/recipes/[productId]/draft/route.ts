import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../../modules/guard";
import {
  moduleErrorResponse,
  readModuleBody,
} from "../../../../../../modules/errors";
import { buildRecipeDraft } from "../../../../../../modules/recipes/draft";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ productId: string }> };

/** `POST /api/modules/recipes/:productId/draft` — spec 0214: el texto dictado → borrador de la
 * receta por unidad. No guarda la receta; se confirma con el `PUT` de la receta. */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireModuleAccess(request, "recipes");
  if ("response" in auth) return auth.response;
  try {
    const { productId } = await params;
    const result = await buildRecipeDraft(
      auth.business.id,
      auth.userId,
      productId,
      await readModuleBody(request),
    );
    return NextResponse.json(result);
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos analizar el texto.");
  }
}
