import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../../server/api-owner";
import { requireApiPermission } from "../../../../server/api-permission";
import { BrandError, createLogoUpload } from "../../../../server/brand";

export const runtime = "nodejs";

/** Spec 0072 §D3: dejo de resolver con `getSession` pelado —o sea CUALQUIER sesion de
 * merchant_auth, incluida la de un integrante sin nada, preparaba una carga—.
 * **Spec 0086 §3: el guard es el alcance `brand`.** */
export async function POST(request: Request) {
  const auth = await requireApiPermission(request, "brand", {
    missingPermission: "No tienes permiso para gestionar la marca.",
    emailNotVerified: "Verificá tu email para gestionar la marca.",
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
    // Spec 0086 §10: el negocio sale del guard, no de un segundo resolvedor owner-only.
    return NextResponse.json(
      await createLogoUpload(auth.userId, body, auth.business.id),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BrandError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos preparar la carga del logo." },
      { status: 503 },
    );
  }
}
