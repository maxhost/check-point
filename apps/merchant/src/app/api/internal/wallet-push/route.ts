import { NextResponse } from "next/server";
import { runPushWorker } from "../../../../server/wallet/push-worker";
import { pushChannelFromEnv } from "../../../../server/wallet/push-channel";

export const runtime = "nodejs";

/** Cron worker (ADR 0037): drains `wallet_push_queue` respecting priority + cooldown.
 * Authenticated like the other internal crons (`Authorization: Bearer ${CRON_SECRET}`);
 * the durability net behind the best-effort inline dispatch of the grant path. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const summary = await runPushWorker({ channel: pushChannelFromEnv() });
  return NextResponse.json({ ok: true, ...summary });
}
