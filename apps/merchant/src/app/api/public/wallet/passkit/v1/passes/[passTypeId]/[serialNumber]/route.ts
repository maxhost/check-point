import { NextResponse, type NextRequest } from "next/server";
import {
  authorizePass,
  passServeData,
} from "../../../../../../../../../server/wallet/passkit";
import { passKitLimiter } from "../../../../../../../../../server/wallet/pass-rate-limit";
import { getWalletProvider } from "../../../../../../../../../server/wallet/provider";
import { ensureWalletPass } from "../../../../../../../../../server/wallet/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ serialNumber: string }> };

/** PassKit "get latest version of a pass" (spec 0033): serves the `.pkpass` with the
 * current "Última novedad" field. Authorized with the pass token; `Last-Modified` =
 * `message_updated_at`; `304` when `If-Modified-Since` is at/after that tag. */
export async function GET(request: NextRequest, { params }: Params) {
  const { serialNumber } = await params;
  if (!passKitLimiter.check(serialNumber)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      {
        status: 429,
      },
    );
  }

  const auth = await authorizePass(
    serialNumber,
    request.headers.get("authorization"),
  );
  if (auth.status === "unauthorized")
    return new NextResponse(null, { status: 401 });
  if (auth.status === "not_found")
    return new NextResponse(null, { status: 404 });

  const data = await passServeData(serialNumber);
  if (!data) return new NextResponse(null, { status: 404 });

  // Conditional GET: 304 when the cached copy is at/after the current tag.
  const ims = request.headers.get("if-modified-since");
  if (ims && data.messageUpdatedAt) {
    const since = Date.parse(ims);
    if (
      Number.isFinite(since) &&
      Math.floor(data.messageUpdatedAt.getTime() / 1000) <=
        Math.floor(since / 1000)
    ) {
      return new NextResponse(null, { status: 304 });
    }
  }

  const provider = getWalletProvider();
  if (!provider.appleConfigured) return new NextResponse(null, { status: 503 });
  // Reuse the STABLE per-pass authToken so the served pass matches the installed
  // one. Legacy rows (authToken null) are backfilled once via ensureWalletPass,
  // migrating them forward to the stable token on this serve.
  const authenticationToken =
    data.authToken ??
    (await ensureWalletPass(data.consumerId, "apple")).authToken;
  const { bytes, mime } = await provider.buildApplePass({
    serialNumber: data.serialNumber,
    qrToken: data.qrToken,
    firstName: data.firstName,
    lastName: data.lastName,
    origin: request.nextUrl.origin,
    webViewToken: data.webViewToken,
    latestMessage: data.latestMessage,
    authenticationToken,
  });

  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Cache-Control": "no-store",
  };
  if (data.messageUpdatedAt)
    headers["Last-Modified"] = data.messageUpdatedAt.toUTCString();

  return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
}
