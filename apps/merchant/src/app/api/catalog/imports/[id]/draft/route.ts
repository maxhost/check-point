import { NextResponse } from "next/server";
import { saveDraft } from "../../../../../../server/catalog-import";
import {
  importError,
  readOptionalJson,
  requireImportAccess,
} from "../../_auth";

export const runtime = "nodejs";

/** §6 — guardar la revision. Solo en `ready`, con optimistic locking por `draft_version`. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const saved = await saveDraft(
      auth.business,
      id,
      await readOptionalJson(request),
    );
    return NextResponse.json(saved);
  } catch (error) {
    return importError(error, "No pudimos guardar el borrador.");
  }
}
