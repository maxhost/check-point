import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../../modules/guard";
import {
  moduleErrorResponse,
  readModuleBody,
} from "../../../../../../modules/errors";
import { buildDraft } from "../../../../../../modules/stock/draft";

export const dynamic = "force-dynamic";

/** `POST /api/modules/stock/entries/draft` — spec 0212: el texto dictado → borrador de lineas.
 * No guarda stock; la confirmacion va por `POST /api/modules/stock/entries`. */
export async function POST(request: Request) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const result = await buildDraft(
      auth.business.id,
      auth.userId,
      await readModuleBody(request),
    );
    return NextResponse.json(result);
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos analizar el texto.");
  }
}
