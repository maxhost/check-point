import { NextResponse } from "next/server";
import { grantAccrual } from "../../../../server/counter";
import { counterError, readJson, requireOperator } from "../_auth";

export const runtime = "nodejs";

/** Grants points/stamps for a sale, atomic and idempotent by `clientRequestId`.
 * A retry with the same id returns the same order without re-granting. */
export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readJson(request);
    const result = await grantAccrual(auth.business, auth.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    return counterError(error, "No pudimos acreditar.");
  }
}
