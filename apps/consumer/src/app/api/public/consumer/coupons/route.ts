import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { listConsumerCoupons } from "@mi-pasaporte/domain/server/consumer/coupons";
import { parseGeo } from "@mi-pasaporte/domain/server/consumer/cross-facts";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0106 E3 — `GET /api/public/consumer/coupons`: the session consumer's usable campaign
 * coupons, with their rule (contract `0106-contratos-de-api.md` §E3). The consumer comes
 * from `resolveSession` (cookie `consumer_session`) and NEVER from the request, so no caller
 * can list another consumer's coupons. No session → `401 unauthenticated`, like
 * `marketing-opt-out`.
 *
 * Spec 0148 P0: `?lat=&lng=` (optional, together — the same rules as the cross offers' C1, a
 * bad pair is a `400 validation`) decide «aca»; the answer is `{ here, coupons }` and each
 * coupon says whether it is the consumer's choice (`selected`). The GPS is not stored.
 */
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
  const params = request.nextUrl.searchParams;
  const geo = parseGeo(params.get("lat"), params.get("lng"));
  if (!geo.ok) {
    return NextResponse.json(
      { error: "Revisá la ubicación.", code: "validation", fields: geo.fields },
      { status: 400 },
    );
  }
  return NextResponse.json(await listConsumerCoupons(account.id, geo.gps));
}
