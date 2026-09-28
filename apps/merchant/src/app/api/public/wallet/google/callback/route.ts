import { NextResponse, type NextRequest } from "next/server";
import {
  GoogleCallbackError,
  recordGoogleSave,
  verifyGoogleCallback,
} from "../../../../../../server/wallet/google-callback";
import { issueWelcomeGiftsSafely } from "../../../../../../server/marketing/welcome-issue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Google Wallet's `save`/`del` callback (spec 0107 §4): configured once on the class
 * (`callbackOptions.url`, `tools/google-wallet-callback.ts`). A bad signature (401) or a
 * body that is not the envelope (400) writes NOTHING. A verified `save` of our class stamps
 * `google_saved_at` and issues the welcome gift (best-effort); anything else is a 200
 * without effect — Google retries a non-2xx, and a `del` has nothing to undo.
 */
export async function POST(request: NextRequest) {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId) return new NextResponse(null, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const now = new Date();
  try {
    const message = await verifyGoogleCallback(body, issuerId, now);
    const consumerId = await recordGoogleSave(message, issuerId, now);
    // The Android install: the welcome gift goes out here (ADR 0099 §2).
    if (consumerId) await issueWelcomeGiftsSafely(consumerId);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    if (error instanceof GoogleCallbackError)
      return new NextResponse(null, { status: error.status });
    console.error("[google-callback] failed", error);
    return new NextResponse(null, { status: 503 });
  }
}
