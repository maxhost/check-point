import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../../../modules/guard";
import { moduleErrorResponse } from "../../../../../../../modules/errors";
import { listMovements } from "../../../../../../../modules/stock/movements";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

/** `GET /api/modules/stock/items/:itemId/movements?limit=50` (tope 200), del mas reciente al mas viejo. */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const { itemId } = await params;
    const limit = new URL(request.url).searchParams.get("limit");
    return NextResponse.json({
      movements: await listMovements(auth.business.id, itemId, limit),
    });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos leer los movimientos.");
  }
}
