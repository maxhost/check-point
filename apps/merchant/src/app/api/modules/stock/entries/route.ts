import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../modules/guard";
import {
  moduleErrorResponse,
  readModuleBody,
} from "../../../../../modules/errors";
import { recordEntry } from "../../../../../modules/stock/entries";

export const dynamic = "force-dynamic";

/** `POST /api/modules/stock/entries` — spec 0210 §Entradas: varias compras en una entrada. */
export async function POST(request: Request) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const result = await recordEntry(
      auth.business.id,
      auth.userId,
      await readModuleBody(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos registrar la entrada.");
  }
}
