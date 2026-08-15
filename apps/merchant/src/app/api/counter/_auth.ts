import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
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
