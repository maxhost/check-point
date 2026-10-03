import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { listConsumerNotices } from "@mi-pasaporte/domain/server/consumer/notices";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0139 §3 / ADR 0116 — `GET /api/public/consumer/notices`: the session consumer's
 * counter notices for Actividad, `{ notices: NoticeDTO[] }`, newest first, at most 30. The
 * consumer comes from `resolveSession` (cookie `consumer_session`) and NEVER from the
 * request. No session → `401 unauthenticated`, like `coupons`.
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
  return NextResponse.json({ notices: await listConsumerNotices(account.id) });
}
