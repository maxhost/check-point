import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../../../server/consumer/core";
import { resolveSession } from "../../../../../server/consumer/session";
import { ensureWalletPass } from "../../../../../server/wallet/core";
import { getWalletProvider } from "../../../../../server/wallet/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const account = await resolveSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!account) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  const provider = getWalletProvider();
  if (!provider.googleConfigured) {
    return NextResponse.json(
      {
        error: "Google Wallet no está disponible.",
        code: "google_unconfigured",
      },
      { status: 503 },
    );
  }

  // One pass per (consumer, google) — create-or-reuse the row (object id = serial).
  const pass = await ensureWalletPass(account.id, "google");
  const saveUrl = await provider.buildGoogleSaveUrl({
    serialNumber: pass.serialNumber,
    qrToken: account.qrToken,
    firstName: account.firstName,
    lastName: account.lastName,
    origin: request.nextUrl.origin,
    webViewToken: account.webViewToken,
  });
  // Contract: 302 to the Google save URL (the pass is added on Google's side).
  return NextResponse.redirect(saveUrl, { status: 302 });
}
