import { NextResponse } from "next/server";
import { runCatalogImportReconcile } from "../../../../../server/catalog-import";

export const runtime = "nodejs";
/** Pollear varios imports contra el proveedor no entra en los 10 s del default. 60 s es el
 * techo del plan; si alguna vez no alcanza, la respuesta es bajar el `BATCH`, no subir esto. */
export const maxDuration = 60;

/**
 * Spec 0090 §7 — EL RECONCILIADOR, con el `CRON_SECRET` que ya usan las otras internas.
 * Lo dispara `.github/workflows/catalog-import-reconcile.yml` cada 5 minutos: **no** se
 * agrega un cron a `vercel.json`, donde los dos que hay son el maximo del plan y un tercero
 * hace que Vercel rechace el deploy entero.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const summary = await runCatalogImportReconcile();
  return NextResponse.json({ ok: true, ...summary });
}
