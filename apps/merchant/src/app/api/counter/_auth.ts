import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import { businessStatusFailure } from "../../../server/api-owner";
import {
  CounterError,
  type OperatorBusiness,
  operatorBusiness,
} from "../../../server/counter";

/**
 * Resolves the counter operator: an authenticated merchant_auth user who is a member
 * (owner or staff) of a business. Returns the business + the operator's user id, or the
 * 401/403 response to send. The counter never resolves or accredits over a foreign business.
 */
export async function requireOperator(
  request: Request,
): Promise<
  { business: OperatorBusiness; userId: string } | { response: NextResponse }
> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return {
      response: NextResponse.json({ error: "No autorizado." }, { status: 401 }),
    };
  }
  const business = await operatorBusiness(session.user.id);
  if (!business) {
    return {
      response: NextResponse.json({ error: "Sin negocio." }, { status: 403 }),
    };
  }
  /**
   * EL EJE `status` (spec 0072 §D4), y **por qué acá y no sólo en el login**: `auth.ts` no
   * pisa `session.expiresIn`, así que rige el default de better-auth 1.6.26 —7 días—. Un
   * integrante con la sesión ya abierta seguiría acreditando puntos y destruyendo saldo
   * **una semana entera** después de que el negocio se suspenda o se cierre, porque este
   * guard sólo verificaba que hubiera sesión y que resolviera negocio. Cerrar la puerta no
   * expulsa a quien ya entró. Es la mutación M5.
   *
   * `reasonVisible: false` — el motivo de la suspensión se serializa SOLO al owner (§D4), y
   * el mostrador lo opera también el staff.
   */
  const failure = businessStatusFailure(business.status, null, false);
  if (failure) {
    return {
      response: NextResponse.json(
        { error: failure.message, code: failure.code },
        { status: failure.status },
      ),
    };
  }
  return { business, userId: session.user.id };
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
