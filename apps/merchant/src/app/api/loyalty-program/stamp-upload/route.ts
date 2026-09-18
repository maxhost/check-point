import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../../server/api-owner";
import {
  LoyaltyError,
  createStampUpload,
} from "../../../../server/loyalty-program";

export const runtime = "nodejs";

/** Spec 0072 §D3: el negocio sale de `requireApiOwner` y no del resolvedor ad hoc del
 * dominio, que devolvia negocio incluso para una membresia `disabled`. */
export async function POST(request: Request) {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede gestionar el programa.",
    emailNotVerified: "Verificá tu email para gestionar el programa.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await createStampUpload(auth.business.id, body), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos preparar la carga del sello." },
      { status: 503 },
    );
  }
}
