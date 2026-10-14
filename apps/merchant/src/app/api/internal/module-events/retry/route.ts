import { NextResponse } from "next/server";
import { retryModuleEvents } from "../../../../../server/module-events";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await retryModuleEvents()) });
  } catch {
    return NextResponse.json(
      { ok: false, code: "infrastructure_unavailable" },
      { status: 503 },
    );
  }
}
