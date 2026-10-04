import { NextResponse } from "next/server";
import { validateCoupon } from "../../../../server/counter";
import { counterError, readJson, requireOperator } from "../_auth";

export const runtime = "nodejs";

/**
 * Validates the coupon the consumer chose — 2x1, free product, free text, extra
 * stamps/points (spec 0148 M2). Atomic and idempotent by `clientRequestId`. `requireOperator`
 * (401/403 JSON), never the page guard that redirects.
 */
export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readJson(request);
    return NextResponse.json(
      await validateCoupon(auth.business, auth.userId, body),
    );
  } catch (error) {
    return counterError(error, "No pudimos validar el cupón.");
  }
}
