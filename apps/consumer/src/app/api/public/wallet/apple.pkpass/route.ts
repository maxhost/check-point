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
  if (!provider.appleConfigured) {
    return NextResponse.json(
      { error: "Apple Wallet no está disponible.", code: "apple_unconfigured" },
      { status: 503 },
    );
  }

  // One pass per (consumer, apple) — create-or-reuse the row (with its STABLE
  // authToken), then (re)build bytes embedding that same token every time.
  const pass = await ensureWalletPass(account.id, "apple");
  const { bytes, mime } = await provider.buildApplePass({
    serialNumber: pass.serialNumber,
    qrToken: account.qrToken,
    firstName: account.firstName,
    lastName: account.lastName,
    // Spec 0114: `CONSUMER_ORIGIN` (my.) si esta; si no, el del request.
    origin: consumerOriginOr(request.nextUrl.origin),
    webViewToken: account.webViewToken,
    // The doors of spec 0065: a pass installed today already carries its geofences.
    passLocations: await passLocationsForConsumer(account.id),
    authenticationToken: pass.authToken,
  });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": 'attachment; filename="mi-pasaporte.pkpass"',
      "Cache-Control": "no-store",
    },
  });
}
