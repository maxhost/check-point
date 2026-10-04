import { NextResponse } from "next/server";
import { getCouponState } from "../../../../server/counter";
import { counterError, requireOperator } from "../_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/counter/coupon-state?membershipId=` (spec 0148 M1): the poll of the consumer's
 * coupon state while the counter has them open — the consumer may choose AFTER the scan.
 * A membership of another business is a 404.
 */
export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const membershipId = new URL(request.url).searchParams.get("membershipId");
    return NextResponse.json(await getCouponState(auth.business, membershipId));
  } catch (error) {
    return counterError(error, "No pudimos leer el cupón.");
  }
}
