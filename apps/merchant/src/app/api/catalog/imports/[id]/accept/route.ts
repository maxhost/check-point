import { NextResponse } from "next/server";
import { acceptImport } from "../../../../../../server/catalog-import";
import {
  importError,
  readOptionalJson,
  requireImportAccess,
} from "../../_auth";

export const runtime = "nodejs";

/**
 * §6 — crear el catalogo. **201** la primera vez y **200 con el mismo resumen** en cualquier
 * repeticion: la idempotencia la da el lock mas el estado `accepted`, **no una clave del
 * cliente**.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const outcome = await acceptImport(
      auth.business,
      id,
      await readOptionalJson(request),
    );
    return NextResponse.json(
      { result: outcome.result },
      { status: outcome.created ? 201 : 200 },
    );
  } catch (error) {
    return importError(error, "No pudimos aceptar la importación.");
  }
}
