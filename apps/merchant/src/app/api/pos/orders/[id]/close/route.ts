import { NextResponse } from "next/server";
import {
  posError,
  readPosBody,
  requirePosOperator,
} from "../../../../../../server/pos/auth";
import { posOrderId } from "../../../../../../server/pos/errors";
import { closePosOrder } from "../../../../../../server/pos/close";

export const runtime = "nodejs";

/** `POST /api/pos/orders/:id/close` (spec 0169): `{ clientRequestId, version, membershipId?,
 * coupon? }`. Sin pase cierra sin acreditar; con pase, la acreditacion del mostrador. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const id = posOrderId((await params).id);
    const body = await readPosBody(request);
    return NextResponse.json(
      await closePosOrder(auth.business, auth.userId, id, body),
    );
  } catch (error) {
    return posError(error, "No pudimos cerrar la venta.");
  }
}
