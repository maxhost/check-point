import { NextResponse } from "next/server";
import { deleteProduct, updateProduct } from "../../../../../server/catalog";
import { catalogError, readJson, requireOwner } from "../../_auth";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    const product = await updateProduct(
      auth.business,
      id,
      await readJson(request),
    );
    return NextResponse.json(product);
  } catch (error) {
    return catalogError(error, "No pudimos guardar el producto.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    return NextResponse.json(await deleteProduct(auth.business, id));
  } catch (error) {
    return catalogError(error, "No pudimos borrar el producto.");
  }
}
