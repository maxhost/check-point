import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../../../server/consumer/core";
import { resolveSession } from "../../../../../server/consumer/session";
import {
  ensureWalletPass,
  setAuthTokenHash,
} from "../../../../../server/wallet/core";
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
  if (!provider.appleConfigured) {
    return NextResponse.json(
      { error: "Apple Wallet no está disponible.", code: "apple_unconfigured" },
      { status: 503 },
    );
  }

  // One pass per (consumer, apple) — create-or-reuse the row, then (re)build bytes.
  const pass = await ensureWalletPass(account.id, "apple");
  const { bytes, mime, authenticationToken } = await provider.buildApplePass({
    serialNumber: pass.serialNumber,
    qrToken: account.qrToken,
    firstName: account.firstName,
    lastName: account.lastName,
    origin: request.nextUrl.origin,
    webViewToken: account.webViewToken,
  });
  // Store only the hash of the web-service authenticationToken (compared in 0033).
  await setAuthTokenHash(pass.id, authenticationToken);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": 'attachment; filename="mi-pasaporte.pkpass"',
      "Cache-Control": "no-store",
    },
  });
}
