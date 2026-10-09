import { NextResponse } from "next/server";
import { posError, requirePosOperator } from "../../../../server/pos/auth";
import { listPosTables } from "../../../../server/tables/pos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /api/pos/tables?locationId=` (spec 0182): `{ tables: [{ id, name, seats, openOrderId }] }`,
 * the active tables of an active location. */
export async function GET(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const locationId = new URL(request.url).searchParams.get("locationId");
    return NextResponse.json({
      tables: await listPosTables(auth.business.id, locationId),
    });
  } catch (error) {
    return posError(error, "No pudimos leer las mesas.");
  }
}
