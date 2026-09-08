import { NextResponse } from "next/server";
import { redeemReward } from "../../../../server/counter";
import { counterError, readJson, requireOperator } from "../_auth";

export const runtime = "nodejs";

/** Redeems one reward for a scanned membership (spec 0055): debits the balance inside
 * an interactive transaction that holds the membership lock, writes the append-only
 * `core.reward_redemption` row and enqueues the push. Idempotent by `clientRequestId`;
 * the same id with a different `rewardId` is a 409, never a different reward. */
export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readJson(request);
    const result = await redeemReward(auth.business, auth.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    return counterError(error, "No pudimos canjear.");
  }
}
