import { NextResponse } from "next/server";
import { removeCoupon } from "../../../../server/counter";
import {
  posError,
  readPosBody,
  requirePosOperator,
} from "../../../../server/pos/auth";

export const runtime = "nodejs";

/** `POST /api/pos/coupon-remove` (spec 0169): igual que el mostrador — el cupon vuelve al cliente. */
export async function POST(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readPosBody(request);
    return NextResponse.json(await removeCoupon(auth.business, body));
  } catch (error) {
    return posError(error, "No pudimos quitar el cupón.");
  }
}
