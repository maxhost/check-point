import { NextResponse } from "next/server";
import {
  posError,
  requirePosOperator,
} from "../../../../../../server/pos/auth";
import { posOrderId } from "../../../../../../server/pos/errors";
import { voidPosOrder } from "../../../../../../server/pos/orders";

export const runtime = "nodejs";

/** `POST /api/pos/orders/:id/void` (spec 0169): anular una orden abierta (idempotente). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const id = posOrderId((await params).id);
    return NextResponse.json(
      await voidPosOrder(auth.business, auth.userId, id),
    );
  } catch (error) {
    return posError(error, "No pudimos anular la orden.");
  }
}
