import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../../server/api-owner";
import { requireApiPermission } from "../../../../server/api-permission";
import {
  LoyaltyError,
  createStampUpload,
} from "../../../../server/loyalty-program";

export const runtime = "nodejs";

/** Spec 0072 §D3: el negocio sale del guard y no del resolvedor ad hoc del dominio, que
 * devolvia negocio incluso para una membresia `disabled`.
 * **Spec 0086 §3: ese guard es ahora el alcance `loyalty`.** `createStampUpload` recibe el
 * `businessId` que el guard resolvio, asi que esta ruta funciona igual para un integrante. */
export async function POST(request: Request) {
  const auth = await requireApiPermission(request, "loyalty", {
    missingPermission: "No tienes permiso para gestionar el programa.",
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
