import { NextResponse } from "next/server";
import { expireClosingPrograms } from "../../../../server/loyalty-program";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  await expireClosingPrograms();
  return NextResponse.json({ ok: true });
}
