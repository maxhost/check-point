import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import { CatalogError, type OwnerBusiness } from "../../../server/catalog";

/**
 * Resolves the owner's business or returns the 401/403 response to send.
 *
 * **Desde la spec 0072 delega en `requireApiOwner`** y deja de usar el resolvedor ad hoc
 * del dominio, que NO filtraba `memberships.status='active'`: un integrante dado de baja
 * seguia resolviendo negocio acá. Gana ademas el gate de email verificado y el eje
 * `core.business.status`.
 *
 * `currencyCode` sale del mismo `innerJoin(businesses)` que ya hacia `ownerContext`, asi que
 * la forma `OwnerBusiness` que el catalogo consume no cambia.
 */
export async function requireOwner(
  request: Request,
): Promise<{ business: OwnerBusiness } | { response: NextResponse }> {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede gestionar el catálogo.",
    emailNotVerified: "Verificá tu email para gestionar el catálogo.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return {
    business: {
      id: auth.business.id,
      currencyCode: auth.business.currencyCode,
    },
  };
}

export function catalogError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CatalogError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new CatalogError(400, "El cuerpo de la solicitud no es válido.");
  }
}
