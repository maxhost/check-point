import { NextResponse } from "next/server";
import { runMarketingTick } from "../../../../server/marketing/tick";

export const runtime = "nodejs";
/**
 * The tick walks every active campaign and every consumer with something in the pass;
 * the 10 s default of the platform is the wrong budget for that. 60 s is the ceiling of
 * the Hobby plan — if a run ever needs more, the answer is to page the work, not to
 * raise a number that cannot go higher.
 */
export const maxDuration = 60;

/**
 * Marketing tick (spec 0065). Same authentication as the other internal crons
 * (`Authorization: Bearer ${CRON_SECRET}`), and driven by
 * `.github/workflows/marketing-tick.yml` because `vercel.json` is already at the Hobby
 * plan's two-cron ceiling (`CLAUDE.md`: a third cron makes Vercel reject the deploy).
 *
 * Answers 200 with the run's summary, or with `{skipped:'tick_in_flight'}` when another
 * run holds the advisory lock — a skipped run is a normal outcome, not a failure, and
 * answering 4xx/5xx would make the workflow red for doing exactly the right thing.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const result = await runMarketingTick();
  return NextResponse.json({ ok: true, ...result });
}
