import { NextResponse } from "next/server";
import { redeemCoupon } from "../../../../server/counter";
import { counterError, readJson, requireOperator } from "../_auth";

export const runtime = "nodejs";

/**
 * Hands over the coupon of an active campaign turn (spec 0065 phase C). Atomic and
 * idempotent by `clientRequestId`: the same id answers 200 with the same row, a
 * different id over the same turn is 409 `already_redeemed`.
 *
 * `requireOperator`, NOT `requireBackofficeSession`: the latter is a PAGE guard that
 * answers with `redirect("/login")`, which on a POST is a 307 and not the 401/403 the
 * spec's isolation item demands. Same guard `redeem`, `grant` and `resolve` already use.
 */
export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readJson(request);
    return NextResponse.json(
      await redeemCoupon(auth.business, auth.userId, body),
    );
  } catch (error) {
    return counterError(error, "No pudimos canjear el cupón.");
  }
}
