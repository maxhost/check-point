import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PassKit device log sink (spec 0033): PassKit POSTs `{logs:[...]}` for observability.
 * Unauthenticated by design; we accept and drop (or console) — always `200`. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { logs?: unknown };
    if (Array.isArray(body?.logs) && body.logs.length > 0) {
      console.info("[passkit-log]", JSON.stringify(body.logs).slice(0, 2000));
    }
  } catch {
    // ignore malformed bodies — the log endpoint is best-effort.
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
