import { NextResponse } from "next/server";
import { getCouponState } from "../../../../server/counter";
import { posError, requirePosOperator } from "../../../../server/pos/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /api/pos/coupon-state?membershipId=` (spec 0169): igual que el mostrador. */
export async function GET(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const membershipId = new URL(request.url).searchParams.get("membershipId");
    return NextResponse.json(await getCouponState(auth.business, membershipId));
  } catch (error) {
    return posError(error, "No pudimos leer el cupón.");
  }
}
