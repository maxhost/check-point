import { NextResponse } from "next/server";
import {
  activeImport,
  createImport,
  toImportDTO,
} from "../../../../server/catalog-import";
import { importError, readOptionalJson, requireImportAccess } from "./_auth";

export const runtime = "nodejs";

/**
 * Spec 0090 §6 — `POST /api/catalog/imports`: reserva + URLs firmadas.
 *
 * **201**. Se apropia de un import abandonado en `pending_upload`; en `queued`/`analyzing`/
 * `ready` responde `409 catalog_import_in_progress`.
 */
export async function POST(request: Request) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const created = await createImport(
      auth.business,
      auth.userId,
      await readOptionalJson(request),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return importError(error, "No pudimos preparar la importación.");
  }
}

/**
 * `GET /api/catalog/imports` — **el import activo, para retomar**. Devuelve el unico no
 * terminal del negocio o `{ "import": null }`. Es la primera llamada que conviene hacer al
 * abrir la pantalla: sin esto, un merchant que cerro el modal con un borrador listo no
 * puede volver a el y encima gasto su analisis del dia.
 */
export async function GET(request: Request) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const row = await activeImport(auth.business.id);
    return NextResponse.json({ import: row ? toImportDTO(row) : null });
  } catch (error) {
    return importError(error, "No pudimos cargar la importación.");
  }
}
