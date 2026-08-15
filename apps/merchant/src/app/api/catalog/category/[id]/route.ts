import { NextResponse } from "next/server";
import { deleteCategory, renameCategory } from "../../../../../server/catalog";
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
    const category = await renameCategory(
      auth.business,
      id,
      await readJson(request),
    );
    return NextResponse.json(category);
  } catch (error) {
    return catalogError(error, "No pudimos renombrar la categoría.");
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
    return NextResponse.json(await deleteCategory(auth.business, id));
  } catch (error) {
    return catalogError(error, "No pudimos borrar la categoría.");
  }
}
