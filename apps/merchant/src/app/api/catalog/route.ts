import { NextResponse } from "next/server";
import { listCatalog } from "../../../server/catalog";
import { catalogError, requireOwner } from "./_auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await listCatalog(auth.business));
  } catch (error) {
    return catalogError(error, "No pudimos cargar el catálogo.");
  }
}
