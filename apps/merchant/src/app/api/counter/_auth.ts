import { NextResponse } from "next/server";
import { CounterError } from "../../../server/counter";
import {
  type OperatorGuardResult,
  resolveOperator,
} from "../../../server/operator-guard";

/**
 * Resolves the counter operator: an authenticated merchant_auth user who is an ACTIVE member
 * of a business **and** —since spec 0086— either its owner or a staff member holding the
 * `counter` permission. Returns the business + the operator's user id, or the 401/403
 * response to send. The counter never resolves or accredits over a foreign business.
 *
 * The ladder (session → member → permission → owner's email → business `status`) lives in
 * `server/operator-guard.ts` since spec 0169, shared with the POS; its docblocks say why each
 * step is where it is. Cubre TODAS las rutas del mostrador (`resolve`, `grant`, `redeem`,
 * `coupon-remove`, `coupon-state`) porque todas pasan por acá; `resolve` es una lectura y se
 * gatea igual, a propósito: la decisión del owner fue «el mostrador» como unidad.
 */
export async function requireOperator(
  request: Request,
): Promise<OperatorGuardResult> {
  return resolveOperator(request, "counter", {
    missingPermission: "No tienes permiso para operar el mostrador.",
    emailNotVerified: "Verifica tu email para operar el mostrador.",
  });
}

export function counterError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CounterError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export async function readJson(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new CounterError(400, "invalid_body", "El cuerpo no es válido.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CounterError) throw error;
    throw new CounterError(
      400,
      "invalid_body",
      "El cuerpo de la solicitud no es válido.",
    );
  }
}
