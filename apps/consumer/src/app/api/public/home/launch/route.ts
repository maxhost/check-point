import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { issueWelcomeGiftsSafely } from "@mi-pasaporte/domain/server/marketing/welcome-issue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The installed app calls this on its first standalone launch, after /c bootstraps the session. */
export async function POST(request: NextRequest) {
  const account = await resolveSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!account)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  await getDb().execute(sql`
    update consumer.consumer_account
    set home_launched_at = coalesce(home_launched_at, now())
    where id = ${account.id}`);
  const welcomeIssued = await issueWelcomeGiftsSafely(account.id);
  return NextResponse.json({ homeLaunched: true, welcomeIssued });
}
