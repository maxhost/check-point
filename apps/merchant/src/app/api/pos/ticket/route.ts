import { NextResponse } from "next/server";
import { posError, requirePosOperator } from "../../../../server/pos/auth";
import { readTicketSettings } from "../../../../server/ticket-settings/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /api/pos/ticket` (spec 0184, permiso `pos`) → `{ showBusinessName, showTable }`: lo que el
 * POS lee al abrir para armar el ticket (`printing/buildTicket`). */
export async function GET(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await readTicketSettings(auth.business.id));
  } catch (error) {
    return posError(error, "No pudimos leer el ajuste del ticket.");
  }
}
