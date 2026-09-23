import { NextResponse } from "next/server";
import {
  createImport,
  latestImport,
  toImportDTO,
} from "../../../../server/catalog-import";
import { importError, readOptionalJson, requireImportAccess } from "./_auth";

export const runtime = "nodejs";

/**
 * Spec 0090 §6 — `POST /api/catalog/imports`: reserva + URLs firmadas.
 *
 * **201**. Se apropia de un import abandonado en `pending_upload`; en `queued`/`analyzing`
 * responde `409 catalog_import_in_progress`.
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
 * Spec 0091 §9 — `GET /api/catalog/imports`: **el ULTIMO import del negocio**, abierto o
 * terminal, o `{ "import": null }` si nunca importo.
 *
 * Es la primera llamada que conviene hacer al abrir la pantalla. Devuelve el terminal a
 * proposito: sin eso, un reload despues de importar **pierde el resultado**, porque un
 * `accepted` ya no es un import abierto.
 */
export async function GET(request: Request) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const row = await latestImport(auth.business.id);
    return NextResponse.json({ import: row ? toImportDTO(row) : null });
  } catch (error) {
    return importError(error, "No pudimos cargar la importación.");
  }
}
