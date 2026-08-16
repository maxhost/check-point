import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../../../server/consumer/core";
import { resolveSession } from "../../../../../server/consumer/session";
import {
  upsertSubscription,
  webPushSubscriptionResponse,
} from "../../../../../server/push/subscriptions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SubscribeBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

/**
 * Captures a Web Push subscription for the SESSION consumer (spec 0037). The row is
 * always associated to the consumer resolved from the 0028 cookie — a caller can never
 * subscribe another consumer. Upsert by `endpoint` makes re-posting idempotent. The
 * response omits `endpoint`/`p256dh`/`auth` (device secrets, anti-leak rule).
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const account = await resolveSession(token);
  if (!account) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthenticated" },
      { status: 401 },
    );
  }

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo inválido.", code: "bad_request" },
      { status: 400 },
    );
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const p256dh =
    typeof body.keys?.p256dh === "string" ? body.keys.p256dh : null;
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : null;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Suscripción incompleta.", code: "bad_request" },
      { status: 400 },
    );
  }

  const row = await upsertSubscription({
    consumerId: account.id,
    endpoint,
    p256dhKey: p256dh,
    authKey: auth,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json(
    { subscription: webPushSubscriptionResponse(row) },
    { status: 201 },
  );
}
