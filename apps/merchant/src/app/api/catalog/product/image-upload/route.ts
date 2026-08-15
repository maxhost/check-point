import { NextResponse } from "next/server";
import { createProductUpload } from "../../../../../server/catalog";
import { catalogError, readJson, requireOwner } from "../../_auth";

export const runtime = "nodejs";

/**
 * Prepares a signed R2 upload for a product image. Business-scoped (not product-scoped)
 * so it also serves product creation, where no product id exists yet; the returned
 * `uploadId` travels with the product save (deferred, mirroring the stamp pipeline).
 */
export async function POST(request: Request) {
  const auth = await requireOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const prepared = await createProductUpload(
      auth.business.id,
      await readJson(request),
    );
    return NextResponse.json(prepared, { status: 201 });
  } catch (error) {
    return catalogError(error, "No pudimos preparar la carga de la imagen.");
  }
}
