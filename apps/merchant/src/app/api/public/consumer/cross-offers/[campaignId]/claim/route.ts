import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../../../../../server/consumer/core";
import { isUuid } from "../../../../../../../server/counter/core";
import { claimCrossOffer } from "../../../../../../../server/consumer/cross-offers";
import { parseGeo } from "../../../../../../../server/consumer/cross-facts";
import { resolveSession } from "../../../../../../../server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UNAVAILABLE = {
  error: "Esta oferta ya no está disponible.",
  code: "offer_unavailable",
};

/**
 * Spec 0112 C2 — `POST /api/public/consumer/cross-offers/{campaignId}/claim`, body
 * `{ lat?, lng? }`. Issues the cross coupon to the SESSION's consumer (never a request
 * field): 201 issued now, 200 already had it (idempotent), 404 `offer_unavailable` for ANY
 * refusal — one code on purpose, the consumer is not told why. An id that is not a UUID is
 * that same 404 before touching the base (a `uuid` column compared to garbage is `22P02`).
 * An empty body is `{}`; a body that is not JSON is a 400 `validation`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const account = await resolveSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!account) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  let body: Record<string, unknown> = {};
  const raw = await request.text();
  if (raw.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(raw);
      body =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      return NextResponse.json(
        {
          error: "Cuerpo inválido.",
          code: "validation",
          fields: { body: "El cuerpo tiene que ser JSON." },
        },
        { status: 400 },
      );
    }
  }
  const geo = parseGeo(body.lat, body.lng);
  if (!geo.ok) {
    return NextResponse.json(
      { error: "Revisá la ubicación.", code: "validation", fields: geo.fields },
      { status: 400 },
    );
  }
  const { campaignId } = await params;
  if (!isUuid(campaignId))
    return NextResponse.json(UNAVAILABLE, { status: 404 });
  const result = await claimCrossOffer(account.id, campaignId, geo.gps);
  if (result.status === 404)
    return NextResponse.json(UNAVAILABLE, { status: 404 });
  return NextResponse.json(
    { coupon: result.coupon },
    { status: result.status },
  );
}
