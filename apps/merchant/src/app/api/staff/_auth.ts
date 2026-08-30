import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import { StaffError, ownerContext } from "../../../server/staff";

/**
 * Resolves the caller as the OWNER of a business (ADR 0044). Staff management is owner-only
 * and scoped to the owner's own business. Returns the business + owner user id, or the
 * 401/403 response to send.
 */
export async function requireStaffOwner(
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
        { error: "Solo el owner puede gestionar el personal." },
        { status: 403 },
      ),
    };
  }
  return { business: { id: business.id } };
}

export function staffError(error: unknown, fallback: string): NextResponse {
  if (error instanceof StaffError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 503 });
}
