import { NextResponse } from "next/server";
import {
  posError,
  readPosBody,
  requirePosOperator,
} from "../../../../server/pos/auth";
import { createPosOrder } from "../../../../server/pos/orders";
import { listPosOrders } from "../../../../server/pos/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /api/pos/orders` (spec 0169): `{ open, closedToday }`. */
export async function GET(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await listPosOrders(auth.business.id));
  } catch (error) {
    return posError(error, "No pudimos leer las órdenes.");
  }
}

/** `POST /api/pos/orders` (spec 0169): `{ tableLabel, locationId?, items }` → `201 PosOrder`. */
export async function POST(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readPosBody(request);
    const order = await createPosOrder(auth.business, auth.userId, body);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return posError(error, "No pudimos guardar la orden.");
  }
}
