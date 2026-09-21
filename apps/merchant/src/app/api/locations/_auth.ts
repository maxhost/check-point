import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../server/api-owner";
import { requireApiPermission } from "../../../server/api-permission";
import { LocationError } from "../../../server/locations";

/**
 * Spec 0086 §3 — EL GUARD DE `/api/locations/*`: el permiso `locations`.
 *
 * **Desde la spec 0072 delegaba en `requireApiOwner`** —de ahi vienen el filtro
 * `memberships.status='active'`, el gate de email que esta superficie NO tenia y el eje
 * `core.business.status`—; desde la 0086 delega en `requireApiPermission`, que conserva esos
 * pasos y suma el alcance.
 *
 * **CAMBIO DE CONTRATO:** deja de contestar `not_owner`; ahora `not_member` o
 * `missing_permission` (`0086-contratos-de-api.md` §7).
 *
 * **`POST /api/locations/:locationId/status` va CON el permiso** y no queda owner-only:
 * archivar un local es REVERSIBLE y es decision textual del owner (ADR 0079 §2, «van»).
 *
 * El eje PLAN **no entra acá** (ADR 0073 §1): el tope de locales se evalua en la transaccion
 * que escribe, con un contexto que sale de la suscripcion del NEGOCIO y que no tiene nocion
 * de usuario. Un staff con `locations` choca contra el mismo tope que el owner **sin una
 * linea nueva**.
 */
export async function requireLocationsOwner(
  request: Request,
): Promise<{ business: { id: string } } | { response: NextResponse }> {
  const auth = await requireApiPermission(request, "locations", {
    missingPermission: "No tienes permiso para gestionar los locales.",
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
