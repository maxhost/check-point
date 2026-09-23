import { NextResponse } from "next/server";
import { resignUploads } from "../../../../../../server/catalog-import";
import { importError, requireImportAccess } from "../../_auth";

export const runtime = "nodejs";

/**
 * §6 — **re-firma** los archivos que siguen en `reserved`, solo en `pending_upload`.
 *
 * Existe porque una URL firmada dura ~10 min y 50 MB por datos moviles puede pasarse: sin
 * esta ruta, una subida cortada obliga a empezar el import de cero. **No** cambia `position`
 * ni crea filas.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    return NextResponse.json(await resignUploads(auth.business, id));
  } catch (error) {
    return importError(error, "No pudimos volver a preparar la carga.");
  }
}
