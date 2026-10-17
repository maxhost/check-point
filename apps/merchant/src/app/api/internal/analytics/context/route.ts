import { NextResponse } from "next/server";
import { ingestExternalContext } from "../../../../../server/analytics/context/run";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await ingestExternalContext());
  } catch {
    return NextResponse.json(
      { error: "No pudimos actualizar el contexto." },
      { status: 503 },
    );
  }
}
