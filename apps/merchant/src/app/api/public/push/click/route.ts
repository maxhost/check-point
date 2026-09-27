import { NextResponse } from "next/server";
import { recordPushClick } from "../../../../../server/marketing/push-delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/public/push/click — the service worker reports the click of a campaign Web
 * Push (spec 0103 §9). No session: the SW sends only the push id. 204 for ANY uuid,
 * whether it exists or not, so the endpoint reveals no ids; a body without one is 400.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const id =
    body && typeof body === "object" ? (body as { id?: unknown }).id : null;
  if (typeof id !== "string" || !UUID.test(id))
    return NextResponse.json(
      { error: "El cuerpo no es válido.", code: "invalid_body" },
      { status: 400 },
    );
  await recordPushClick(id);
  return new NextResponse(null, { status: 204 });
}
