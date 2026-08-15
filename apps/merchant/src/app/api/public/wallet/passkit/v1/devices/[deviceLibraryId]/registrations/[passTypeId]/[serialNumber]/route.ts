import { NextResponse, type NextRequest } from "next/server";
import {
  authorizePass,
  registerDevice,
  unregisterDevice,
} from "../../../../../../../../../../../server/wallet/passkit";
import { passKitLimiter } from "../../../../../../../../../../../server/wallet/pass-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = {
  params: Promise<{
    deviceLibraryId: string;
    passTypeId: string;
    serialNumber: string;
  }>;
};

const RATE_LIMITED = NextResponse.json(
  { error: "Demasiadas solicitudes." },
  { status: 429 },
);
const UNAUTHORIZED = new NextResponse(null, { status: 401 });
const NOT_FOUND = new NextResponse(null, { status: 404 });

/** PassKit device registration (spec 0033): the OS registers/unregisters a device for
 * updates to one serial. Authorized with the pass's `ApplePass` token; anti-DoS
 * rate-limit keyed by serial. */
export async function POST(request: NextRequest, { params }: Params) {
  const { serialNumber, deviceLibraryId } = await params;
  if (!passKitLimiter.check(serialNumber)) return RATE_LIMITED;

  const auth = await authorizePass(
    serialNumber,
    request.headers.get("authorization"),
  );
  if (auth.status === "unauthorized") return UNAUTHORIZED;
  if (auth.status === "not_found") return NOT_FOUND;

  let pushToken = "";
  try {
    const body = (await request.json()) as { pushToken?: unknown };
    if (typeof body?.pushToken === "string") pushToken = body.pushToken;
  } catch {
    pushToken = "";
  }
  if (!pushToken) return new NextResponse(null, { status: 400 });

  const { created } = await registerDevice({
    passId: auth.pass.id,
    deviceLibraryId,
    pushToken,
  });
  return new NextResponse(null, { status: created ? 201 : 200 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { serialNumber, deviceLibraryId } = await params;
  if (!passKitLimiter.check(serialNumber)) return RATE_LIMITED;

  const auth = await authorizePass(
    serialNumber,
    request.headers.get("authorization"),
  );
  if (auth.status === "unauthorized") return UNAUTHORIZED;
  if (auth.status === "not_found") return NOT_FOUND;

  await unregisterDevice({ passId: auth.pass.id, deviceLibraryId });
  return new NextResponse(null, { status: 200 });
}
