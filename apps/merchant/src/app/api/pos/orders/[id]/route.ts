import { NextResponse } from "next/server";
import {
  posError,
  readPosBody,
  requirePosOperator,
} from "../../../../../server/pos/auth";
import { posOrderId } from "../../../../../server/pos/errors";
import { getPosOrder } from "../../../../../server/pos/read";
import { updatePosOrder } from "../../../../../server/pos/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** `GET /api/pos/orders/:id` (spec 0169): `PosOrder`; de otro negocio → 404. */
export async function GET(request: Request, { params }: Params) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const id = posOrderId((await params).id);
    return NextResponse.json(await getPosOrder(auth.business.id, id));
  } catch (error) {
    return posError(error, "No pudimos leer la orden.");
  }
}

/** `PUT /api/pos/orders/:id` (spec 0169): la lista COMPLETA de lineas + `version`. */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const id = posOrderId((await params).id);
    const body = await readPosBody(request);
    return NextResponse.json(await updatePosOrder(auth.business, id, body));
  } catch (error) {
    return posError(error, "No pudimos guardar la orden.");
  }
}
