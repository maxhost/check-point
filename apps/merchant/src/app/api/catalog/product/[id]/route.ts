import { NextResponse } from "next/server";
import {
  deleteProduct,
  updateProduct,
} from "@mi-pasaporte/domain/server/catalog";
import {
  catalogError,
  catalogOptions,
  catalogResponse,
  readJson,
  requireCatalogOwner,
  requireOwner,
} from "../../_auth";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireOwner(request);
    if ("response" in auth) return catalogResponse(request, auth.response);
    const { id } = await params;
    const product = await updateProduct(
      auth.business,
      id,
      await readJson(request),
      catalogOptions(request),
    );
    return catalogResponse(request, NextResponse.json(product));
  } catch (error) {
    return catalogResponse(
      request,
      catalogError(error, "No pudimos guardar el producto."),
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Spec 0086 §3 / ADR 0079 §2: el borrado es DURO y no se delega. `requireCatalogOwner`
  // conserva su `403 not_owner`, que acá sigue siendo literal (sin email desde el ADR 0125).
  const auth = await requireCatalogOwner(request);
  if ("response" in auth) return catalogResponse(request, auth.response);
  const { id } = await params;
  try {
    return catalogResponse(
      request,
      NextResponse.json(await deleteProduct(auth.business, id)),
    );
  } catch (error) {
    return catalogResponse(
      request,
      catalogError(error, "No pudimos borrar el producto."),
    );
  }
}
