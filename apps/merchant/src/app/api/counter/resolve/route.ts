import { NextResponse } from "next/server";
import { resolveScan } from "../../../../server/counter";
import { counterError, readJson, requireOperator } from "../_auth";

export const runtime = "nodejs";

/** Resolves a scanned QR to the consumer + this business's program + membership
 * (auto-enrolling if needed). Never serializes the qr_token. */
export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readJson(request);
    const result = await resolveScan(auth.business, body.qrToken as string);
    return NextResponse.json(result);
  } catch (error) {
    return counterError(error, "No pudimos resolver el código.");
  }
}
