import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { claimCrossOffer } from "@mi-pasaporte/domain/server/consumer/cross-offers";
import { claimValleyOffer } from "@mi-pasaporte/domain/server/consumer/valley-offers";
import { parseGeo } from "@mi-pasaporte/domain/server/consumer/cross-facts";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UNAVAILABLE = {
  error: "Esta oferta ya no está disponible.",
  code: "offer_unavailable",
};

function invalidLocation(fields: Record<string, string>) {
  return NextResponse.json(
    { error: "Revisá el local de la oferta.", code: "validation", fields },
    { status: 400 },
  );
}

/**
 * Spec 0136 C2 — `POST /api/public/consumer/cross-offers/{campaignId}/claim`, body
 * `{ lat?, lng? }`. Issues the cross coupon to the SESSION's consumer (never a request
 * field): 201 issued now, 200 already had it (idempotent), 404 `offer_unavailable` for ANY
 * refusal — one code on purpose, the consumer is not told why. An id that is not a UUID is
 * that same 404 before touching the base (a `uuid` column compared to garbage is `22P02`).
 * An empty body is `{}`; a body that is not JSON is a 400 `validation`.
 *
 * Spec 0113 (contract H4): a «Horas valle» offer is claimed WITH `locationId` — the location
 * of its open window —, a cross offer WITHOUT it; the other way round is a 400 on
 * `fields.locationId` (the domain knows which campaign it is). A `locationId` that is not a
 * UUID is that same 400 before touching the base.
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
  const locationId = body.locationId;
  if (locationId !== undefined && !isUuid(locationId))
    return invalidLocation({ locationId: "El local no es válido." });
  const { campaignId } = await params;
  if (!isUuid(campaignId))
    return NextResponse.json(UNAVAILABLE, { status: 404 });
  const result =
    locationId === undefined
      ? await claimCrossOffer(account.id, campaignId, geo.gps)
      : await claimValleyOffer(
          account.id,
          campaignId,
          String(locationId).trim(),
          geo.gps,
        );
  if (result.status === 404)
    return NextResponse.json(UNAVAILABLE, { status: 404 });
  if (result.status === 400) return invalidLocation(result.fields);
  return NextResponse.json(
    { coupon: result.coupon },
    { status: result.status },
  );
}
