import { NextResponse } from "next/server";
import { listCatalog } from "@mi-pasaporte/domain/server/catalog";
import {
  catalogError,
  requireOwner,
  catalogOptions,
  catalogResponse,
} from "./_auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireOwner(request);
    if ("response" in auth) return catalogResponse(request, auth.response);
    return catalogResponse(
      request,
      NextResponse.json(
        await listCatalog(auth.business, catalogOptions(request)),
      ),
    );
  } catch (error) {
    return catalogResponse(
      request,
      catalogError(error, "No pudimos cargar el catálogo."),
    );
  }
}
