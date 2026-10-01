import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { listCrossOffers } from "@mi-pasaporte/domain/server/consumer/cross-offers";
import { parseGeo } from "@mi-pasaporte/domain/server/consumer/cross-facts";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0112 C1 — `GET /api/public/consumer/cross-offers?lat=&lng=`: the «Ofertas cruzadas»
 * of «Mis beneficios», FILTERED (another rubro, ≤ 2 km; ADR 0104). The consumer comes from
 * `resolveSession` (cookie `consumer_session`) and NEVER from the request. The GPS travels
 * per request and is not stored (O4). Reading never issues a coupon (O1).
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
  return NextResponse.json(await listCrossOffers(account.id, geo.gps));
}
