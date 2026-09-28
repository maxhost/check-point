import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../../../server/consumer/core";
import { listConsumerCoupons } from "../../../../../server/consumer/coupons";
import { resolveSession } from "../../../../../server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0106 E3 — `GET /api/public/consumer/coupons`: the session consumer's usable campaign
 * coupons, with their rule (contract `0106-contratos-de-api.md` §E3). The consumer comes
 * from `resolveSession` (cookie `consumer_session`) and NEVER from the request, so no caller
 * can list another consumer's coupons. No session → `401 unauthenticated`, like
 * `marketing-opt-out`.
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
  return NextResponse.json({ coupons: await listConsumerCoupons(account.id) });
}
