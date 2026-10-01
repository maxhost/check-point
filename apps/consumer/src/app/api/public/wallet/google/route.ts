import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { ensureWalletPass } from "@mi-pasaporte/domain/server/wallet/core";
import { passLocationsForConsumer } from "@mi-pasaporte/domain/server/wallet/pass-locations-store";
import { getWalletProvider } from "@mi-pasaporte/domain/server/wallet/provider";
import { consumerOriginOr } from "@mi-pasaporte/domain/server/hosts";

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
    // Spec 0114: `CONSUMER_ORIGIN` (my.) si esta; si no, el del request.
    origin: consumerOriginOr(request.nextUrl.origin),
    webViewToken: account.webViewToken,
    // The doors of spec 0065 (`merchantLocations` + the per-turn modules of the object).
    passLocations: await passLocationsForConsumer(account.id),
  });
  // Contract: 302 to the Google save URL (the pass is added on Google's side).
  return NextResponse.redirect(saveUrl, { status: 302 });
}
