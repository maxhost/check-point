import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../modules/guard";
import { moduleErrorResponse } from "../../../../../modules/errors";
import { listLog } from "../../../../../modules/stock/entries";

export const dynamic = "force-dynamic";

/** `GET /api/modules/stock/movements?limit=50` — spec 0210 §Entradas: el registro de todos los
 * insumos, del mas reciente al mas viejo. */
export async function GET(request: Request) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const limit = new URL(request.url).searchParams.get("limit");
    return NextResponse.json({
      movements: await listLog(auth.business.id, limit),
    });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos leer el registro de stock.");
  }
}
