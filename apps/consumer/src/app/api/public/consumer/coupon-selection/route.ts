import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import {
  clearCouponSelection,
  selectCoupon,
} from "@mi-pasaporte/domain/server/consumer/coupon-selection";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0148 P1/P2 — `PUT`/`DELETE /api/public/consumer/coupon-selection`: the coupon the
 * SESSION's consumer chooses to use (contract `0148-contratos-de-api.md`). The consumer comes
 * from `resolveSession` (cookie `consumer_session`) and NEVER from the request, so nobody can
 * choose — or drop — another consumer's coupon. No session → `401 unauthenticated`.
 */

const UNAUTHENTICATED = { error: "No autorizado.", code: "unauthenticated" };

function invalid(message: string) {
  return NextResponse.json(
    {
      error: "Revisá el cupón.",
      code: "validation",
      fields: { couponId: message },
    },
    { status: 400 },
  );
}

async function readCouponId(request: NextRequest): Promise<string | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const couponId = (body as Record<string, unknown>).couponId;
    return isUuid(couponId) ? String(couponId).trim() : null;
  } catch {
    return null;
  }
}

export async function PUT(request: NextRequest) {
  const account = await resolveSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!account) return NextResponse.json(UNAUTHENTICATED, { status: 401 });
  const couponId = await readCouponId(request);
  if (!couponId) return invalid("El cupón no es válido.");
  const result = await selectCoupon(account.id, couponId);
  if (result.status === 404)
    return NextResponse.json(
      { error: "Ese cupón no existe.", code: result.code },
      { status: 404 },
    );
  if (result.status === 409)
    return NextResponse.json(
      { error: "Ese cupón no se puede usar ahora.", code: result.code },
      { status: 409 },
    );
  return NextResponse.json({ selectedCouponId: result.selectedCouponId });
}

export async function DELETE(request: NextRequest) {
  const account = await resolveSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!account) return NextResponse.json(UNAUTHENTICATED, { status: 401 });
  await clearCouponSelection(account.id);
  return NextResponse.json({ selectedCouponId: null });
}
