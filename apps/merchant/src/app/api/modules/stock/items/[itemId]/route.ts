import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../../modules/guard";
import {
  moduleErrorResponse,
  readModuleBody,
} from "../../../../../../modules/errors";
import { updateItem } from "../../../../../../modules/stock/items";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

/** `PATCH /api/modules/stock/items/:itemId` — `{ name?, status? }` → `200 { item }`. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const { itemId } = await params;
    const item = await updateItem(
      auth.business.id,
      itemId,
      await readModuleBody(request),
    );
    return NextResponse.json({ item });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos guardar el insumo.");
  }
}
