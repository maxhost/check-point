import { NextResponse } from "next/server";
import { runBillingSweep } from "../../../../server/marketing/billing-sweep";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Spec 0189 §D4 — el barrido diario de cobro: pausa las campañas de los negocios que
 * perdieron el acceso (`billing_blocked`) y reanuda las de los que lo recuperaron. Misma
 * autenticación que los demás internos (`Authorization: Bearer ${CRON_SECRET}`).
 *
 * Responde `{ ok, paused, resumed }`.
 *
 * Exporta `POST` (el contrato de la spec) y `GET`: el cron de Vercel (`vercel.json`) invoca
 * con GET, como a los otros dos crons de este proyecto (`loyalty-expiry`, `assets-cleanup`).
 */
async function sweep(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { paused, resumed } = await runBillingSweep();
  return NextResponse.json({ ok: true, paused, resumed });
}

export const POST = sweep;
export const GET = sweep;
