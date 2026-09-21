import { NextResponse } from "next/server";
import { deleteProduct, updateProduct } from "../../../../../server/catalog";
import {
  catalogError,
  readJson,
  requireCatalogOwner,
  requireOwner,
} from "../../_auth";

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
  // Spec 0086 §3 / ADR 0079 §2: el borrado es DURO y no se delega. `requireCatalogOwner`
  // conserva `requireApiOwner` y su `403 not_owner`, que acá sigue siendo literal.
  const auth = await requireCatalogOwner(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  try {
    return NextResponse.json(await deleteProduct(auth.business, id));
  } catch (error) {
    return catalogError(error, "No pudimos borrar el producto.");
  }
}
