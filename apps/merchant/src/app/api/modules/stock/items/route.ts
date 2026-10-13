import { NextResponse } from "next/server";
import { requireModuleAccess } from "../../../../../modules/guard";
import {
  moduleErrorResponse,
  readModuleBody,
} from "../../../../../modules/errors";
import { createItem, listItems } from "../../../../../modules/stock/items";

export const dynamic = "force-dynamic";

/** `GET /api/modules/stock/items?status=active|archived|all` — spec 0210. Permiso `catalog` + Stock. */
export async function GET(request: Request) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const status = new URL(request.url).searchParams.get("status");
    return NextResponse.json({
      items: await listItems(auth.business.id, status),
    });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos leer los insumos.");
  }
}

/** `POST /api/modules/stock/items` — `{ name, unit }` → `201 { item }`. */
export async function POST(request: Request) {
  const auth = await requireModuleAccess(request, "stock");
  if ("response" in auth) return auth.response;
  try {
    const item = await createItem(
      auth.business.id,
      await readModuleBody(request),
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos crear el insumo.");
  }
}
