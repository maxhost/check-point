import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../../../modules/guard";
import {
  moduleErrorResponse,
  readModuleBody,
} from "../../../../../../../modules/errors";
import { recordPurchase } from "../../../../../../../modules/stock/movements";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

/** `POST /api/modules/stock/items/:itemId/purchases` — `{ quantity, totalCost, occurredAt?, note? }`. */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const { itemId } = await params;
    const result = await recordPurchase(
      auth.business.id,
      auth.userId,
      itemId,
      await readModuleBody(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos registrar la compra.");
  }
}
