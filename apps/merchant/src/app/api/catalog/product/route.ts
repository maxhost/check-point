import { NextResponse } from "next/server";
import { createProduct } from "@mi-pasaporte/domain/server/catalog";
import {
  catalogError,
  readJson,
  requireOwner,
  catalogOptions,
  catalogResponse,
} from "../_auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requireOwner(request);
    if ("response" in auth) return catalogResponse(request, auth.response);
    const product = await createProduct(
      auth.business,
      await readJson(request),
      catalogOptions(request),
    );
    return catalogResponse(
      request,
      NextResponse.json(product, { status: 201 }),
    );
  } catch (error) {
    return catalogResponse(
      request,
      catalogError(error, "No pudimos crear el producto."),
    );
  }
}
