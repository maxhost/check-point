import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import { ownerContext } from "../../../server/staff";
import { LocationError } from "../../../server/locations";

/**
 * Resolves the caller as the OWNER of a business (decision 4 of spec 0061: only the owner
 * administers locations). Reuses `ownerContext` — the SAME owner+active resolver
 * `api/staff/*` uses — instead of a second copy that could drift on the `status` filter.
 * Returns the business, or the 401/403 response to send.
 */
export async function requireLocationsOwner(
  request: Request,
): Promise<{ business: { id: string } } | { response: NextResponse }> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return {
      response: NextResponse.json({ error: "No autorizado." }, { status: 401 }),
    };
  }
  const business = await ownerContext(session.user.id);
  if (!business) {
    return {
      response: NextResponse.json(
        { error: "Solo el owner puede gestionar los locales." },
        { status: 403 },
      ),
    };
  }
  return { business: { id: business.id } };
}

export function locationError(error: unknown, fallback: string): NextResponse {
  if (error instanceof LocationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new LocationError(400, "invalid_body", "El cuerpo no es válido.");
  }
}
