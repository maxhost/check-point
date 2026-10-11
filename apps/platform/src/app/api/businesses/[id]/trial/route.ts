import { NextResponse } from "next/server";
import { requireApiAdmin } from "../../../../../server/admin-guard";
import { applyTrialChange } from "../../../../../server/businesses";
import { parseTrialChange } from "../../../../../server/trial";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/businesses/[id]/trial — spec 0190 §D5 (cuerpo y codigos en la tabla de la spec). */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireApiAdmin(request);
  if (!admin.ok) return admin.response;

  const { id } = await context.params;
  const change = parseTrialChange(await request.json().catch(() => null));
  if (!change) {
    return NextResponse.json(
      { code: "invalid_body", message: "Revisa los días o la fecha." },
      { status: 400 },
    );
  }
  if (!UUID_RE.test(id)) return notFound();

  const result = await applyTrialChange({
    businessId: id,
    adminEmail: admin.email,
    change,
    now: new Date(),
  });
  switch (result.kind) {
    case "ok":
      return NextResponse.json({
        trialEndsAt: result.trialEndsAt.toISOString(),
        access: result.access,
        trialDaysLeft: result.trialDaysLeft,
      });
    case "not_found":
      return notFound();
    case "subscription_live":
      return NextResponse.json(
        {
          code: "subscription_live",
          message:
            "Este comercio ya paga: su prueba se mueve en Stripe, no aquí.",
        },
        { status: 409 },
      );
    case "would_block":
      return NextResponse.json(
        {
          code: "would_block",
          message: "Con esa fecha el comercio queda bloqueado. Confírmalo.",
        },
        { status: 409 },
      );
  }
}

function notFound() {
  return NextResponse.json(
    { code: "not_found", message: "No existe ese comercio." },
    { status: 404 },
  );
}
