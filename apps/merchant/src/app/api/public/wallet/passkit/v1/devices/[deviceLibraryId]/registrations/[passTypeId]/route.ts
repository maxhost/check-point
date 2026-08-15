import { NextResponse, type NextRequest } from "next/server";
import { listUpdatedSerials } from "../../../../../../../../../../server/wallet/passkit";
import { passKitLimiter } from "../../../../../../../../../../server/wallet/pass-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ deviceLibraryId: string }> };

/** PassKit "get serials for device" (spec 0033): the serials this device holds that
 * changed since `passesUpdatedSince`. Device-scoped (no `ApplePass` token); anti-DoS
 * rate-limit keyed by the device library id. `204` when nothing changed. */
export async function GET(request: NextRequest, { params }: Params) {
  const { deviceLibraryId } = await params;
  if (!passKitLimiter.check(deviceLibraryId)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      {
        status: 429,
      },
    );
  }

  const passesUpdatedSince =
    request.nextUrl.searchParams.get("passesUpdatedSince");
  const result = await listUpdatedSerials({
    deviceLibraryId,
    passesUpdatedSince,
  });
  if (!result) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result, { status: 200 });
}
