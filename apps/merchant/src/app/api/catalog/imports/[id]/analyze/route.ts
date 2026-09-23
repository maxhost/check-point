import { NextResponse, after } from "next/server";
import {
  runAnalysis,
  startAnalyze,
} from "../../../../../../server/catalog-import";
import { importError, requireImportAccess } from "../../_auth";

export const runtime = "nodejs";

/**
 * §6 — **202 en el orden de un segundo**. La ruta solo sniffea cabeceras y encola; el
 * trabajo largo va **dentro de `after()`**, que mantiene viva la invocacion sin bloquear la
 * respuesta. Fuera de un scope de request (tests) `after()` tira y se cae al inline, igual
 * que `dispatchGranted` en wallet.
 *
 * Repetirla en `queued`/`analyzing`/`ready` devuelve el estado actual **sin** otra llamada
 * al proveedor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireImportAccess(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const outcome = await startAnalyze(auth.business, id);
    if (outcome.queued) {
      const run = () => runAnalysis(id).catch(() => undefined);
      try {
        after(run);
      } catch {
        void run();
      }
    }
    return NextResponse.json({ import: outcome.import }, { status: 202 });
  } catch (error) {
    return importError(error, "No pudimos iniciar el análisis.");
  }
}
