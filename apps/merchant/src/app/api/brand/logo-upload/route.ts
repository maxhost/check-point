import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../../server/api-owner";
import { BrandError, createLogoUpload } from "../../../../server/brand";

export const runtime = "nodejs";

/** Spec 0072 §D3: resuelve owner con `requireApiOwner` (antes: `getSession` pelado, o sea
 * CUALQUIER sesion de merchant_auth —incluida la de un integrante— preparaba una carga). */
export async function POST(request: Request) {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede gestionar la marca.",
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
    return NextResponse.json(await createLogoUpload(auth.userId, body), {
      status: 201,
    });
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
