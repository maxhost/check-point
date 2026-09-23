import { NextResponse } from "next/server";
import {
  cancelImport,
  requireImport,
  toImportDTO,
} from "../../../../../server/catalog-import";
import { importError, requireImportAccess } from "../_auth";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** §6 — estado y borrador. **Allow-list cerrada**: ver `toImportDTO`. Lo ajeno devuelve el
 * mismo 404 que lo inexistente. */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const row = await requireImport(auth.business.id, id);
    return NextResponse.json({ import: toImportDTO(row) });
  } catch (error) {
    return importError(error, "No pudimos cargar la importación.");
  }
}

/** §6 — cancelar inmediatamente. Un resultado tardio del proveedor se descarta porque los
 * writers solo aceptan imports todavia abiertos. **Nunca toca catalogo.** */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    return NextResponse.json(await cancelImport(auth.business, id));
  } catch (error) {
    return importError(error, "No pudimos cancelar la importación.");
  }
}
