import { NextResponse } from "next/server";
import { removeCoupon } from "../../../../server/counter";
import { counterError, readJson, requireOperator } from "../_auth";

export const runtime = "nodejs";

/** Takes back the chosen coupon, valid or not (spec 0153 M3): it goes back to the consumer. */
export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readJson(request);
    return NextResponse.json(await removeCoupon(auth.business, body));
  } catch (error) {
    return counterError(error, "No pudimos quitar el cupón.");
  }
}
