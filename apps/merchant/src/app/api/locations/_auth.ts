import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import { LocationError } from "../../../server/locations";

/**
 * Resolves the caller as the OWNER of a business (decision 4 of spec 0061: only the owner
 * administers locations). Returns the business, or the 401/403 response to send.
 *
 * **Desde la spec 0072 delega en `requireApiOwner`**, que es el resolvedor unico de las 10
 * superficies de API del owner: ahi viven el filtro `memberships.status='active'`, el gate
 * de email verificado —que esta superficie NO tenia— y el eje `core.business.status`.
 */
export async function requireLocationsOwner(
  request: Request,
): Promise<{ business: { id: string } } | { response: NextResponse }> {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede gestionar los locales.",
    emailNotVerified: "Verificá tu email para gestionar los locales.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return { business: { id: auth.business.id } };
}

export function locationError(error: unknown, fallback: string): NextResponse {
  if (error instanceof LocationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new LocationError(400, "invalid_body", "El cuerpo no es válido.");
  }
}
