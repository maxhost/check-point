import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../../server/api-owner";
import { requireApiPermissionSinGateDeEmail } from "../../../../server/api-permission";
import { LoyaltyError } from "@mi-pasaporte/domain/server/loyalty-program";
import { setBalanceExpiry } from "@mi-pasaporte/domain/server/loyalty-program/expiry-setting";

/**
 * PUT /api/loyalty-program/expiry — turns the balance-expiry rule on/off or changes its
 * term (spec 0195 §D3 / ADR 0136). Body `{ months: 3 | 6 | 9 | 12 | null }`. Same guard as
 * the program's `PUT` (delegable with the `loyalty` scope, no email gate, ADR 0122).
 */
export async function PUT(request: Request) {
  const auth = await requireApiPermissionSinGateDeEmail(request, "loyalty", {
    missingPermission: "No tienes permiso para gestionar el programa.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "El cuerpo de la solicitud no es válido.",
        code: "invalid_body",
      },
      { status: 400 },
    );
  }
  const months =
    body && typeof body === "object" && "months" in body
      ? (body as { months: unknown }).months
      : undefined;
  try {
    const result = await setBalanceExpiry({
      userId: auth.userId,
      businessId: auth.business.id,
      months,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message, code: error.code ?? "invalid_expiry" },
        { status: error.status },
      );
    return NextResponse.json(
      {
        error: "No pudimos guardar el vencimiento.",
        code: "program_unavailable",
      },
      { status: 503 },
    );
  }
}
