import { NextResponse } from "next/server";
import { createProduct } from "../../../../server/catalog";
import { catalogError, readJson, requireOwner } from "../_auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const product = await createProduct(auth.business, await readJson(request));
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return catalogError(error, "No pudimos crear el producto.");
  }
}
