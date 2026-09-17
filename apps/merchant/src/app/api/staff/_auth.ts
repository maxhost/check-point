import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import { StaffError, ownerContext } from "../../../server/staff";

/**
 * Resolves the caller as the OWNER of a business (ADR 0044). Staff management is owner-only
 * and scoped to the owner's own business. Returns the business + owner user id, or the
 * 401/403 response to send.
 */
export async function requireStaffOwner(
  request: Request,
): Promise<
  { business: { id: string; slug: string } } | { response: NextResponse }
> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return {
      response: NextResponse.json(
        { error: "No autorizado.", code: "unauthorized" },
        { status: 401 },
      ),
    };
  }
  const business = await ownerContext(session.user.id);
  if (!business) {
    return {
      response: NextResponse.json(
        {
          error: "Solo el owner puede gestionar el personal.",
          code: "not_owner",
        },
        { status: 403 },
      ),
    };
  }
  // El gemelo de API del gate de `requireBackofficeSession` (spec 0067 §3): la misma regla
  // —owner con el email sin verificar no consume nada de lo POSTERIOR al wizard (ADR 0070
  // §11)— pero respondiendo 403 con `code` en vez de redirigir, porque un `redirect()`
  // sobre un POST es un 307 y no el 403 que el contrato declara.
  //
  // VA DESPUÉS DE `ownerContext`, y el orden es la regla, no una optimización: la spec §3
  // dice «solo cuando `role === "owner"`». Puesto antes, un INTEGRANTE —cuyo email es
  // sintético y nunca se verifica— recibía `email_not_verified` en vez de `not_owner`, o
  // sea un código que le pedía hacer algo que no puede hacer. Lo cazó
  // `staff-pin-change.neon.integration.test.ts`.
  //
  // `!== true` y no `!`: un `undefined` cierra en vez de abrir (fail-closed).
  if (session.user.emailVerified !== true) {
    return {
      response: NextResponse.json(
        {
          error: "Verificá tu email para gestionar el personal.",
          code: "email_not_verified",
        },
        { status: 403 },
      ),
    };
  }
  // El `slug` viaja desde la SESION hasta el alta del integrante (spec 0067 §4): que no
  // pueda venir del cuerpo es lo que impide que un owner apunte al negocio de otro.
  return { business: { id: business.id, slug: business.slug } };
}

export function staffError(error: unknown, fallback: string): NextResponse {
  if (error instanceof StaffError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  // Un `throw` que NO es de dominio se presenta como 503 «base caída». Sin esta línea un
  // `TypeError` nuestro se ve idéntico a una base real caída —para la UI y para los logs—,
  // así que el 503 deja de ser diagnosticable. Va el `name`, nunca el mensaje: un mensaje
  // de excepción puede arrastrar datos de la fila que lo produjo.
  console.error("staff_route_unavailable", {
    name: error instanceof Error ? error.name : typeof error,
  });
  return NextResponse.json(
    { error: fallback, code: "staff_unavailable" },
    { status: 503 },
  );
}
