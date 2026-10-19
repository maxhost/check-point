import { NextResponse } from "next/server";
import { privateBackofficeResponse } from "../../../../server/backoffice-scope-http";
import { requireOperator } from "../_auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retired public Counter entry point; preserve the complete operator guard. */
export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return privateBackofficeResponse(auth.response);
  return privateBackofficeResponse(
    NextResponse.json(
      { code: "feature_retired", error: "Esta función ya no está disponible." },
      { status: 410 },
    ),
  );
}
