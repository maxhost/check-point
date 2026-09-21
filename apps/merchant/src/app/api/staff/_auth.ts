import { NextResponse } from "next/server";
import { StaffError } from "../../../server/staff";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import { requireApiPermission } from "../../../server/api-permission";

/**
 * Resolves the caller as the OWNER of a business (ADR 0044). Staff management is owner-only
 * and scoped to the owner's own business.
 *
 * **Desde la spec 0072 esto es un envoltorio de `requireApiOwner`** y ya no una copia: el
 * orden de las cuatro decisiones (sesion → owner activo → email → estado del negocio) vive
 * ahi, y con el vive la razon por la que el gate de email va DESPUES de resolver owner —
 * puesto antes, un INTEGRANTE recibia `email_not_verified` en vez de `not_owner`, lo cazo
 * `staff-pin-change.neon.integration.test.ts`. Lo unico propio que queda es la copia del
 * dominio y el `slug`.
 *
 * El `slug` viaja desde la SESION hasta el alta del integrante (spec 0067 §4): que no pueda
 * venir del cuerpo es lo que impide que un owner apunte al negocio de otro.
 *
 * **⚠️ DESDE LA SPEC 0086 SU UNICO CONSUMIDOR ES `PATCH /api/merchant/business/slug`**, que
 * es una de las CUATRO superficies de la CUENTA del ADR 0079 §8 y **conserva `not_owner`
 * a proposito**. Las cuatro rutas de `/api/staff/*` pasaron a {@link requireStaffAccess}.
 * No la vuelvas a apuntar a una superficie delegable: se llama «owner» porque lo es.
 */
export async function requireStaffOwner(
  request: Request,
): Promise<
  { business: { id: string; slug: string } } | { response: NextResponse }
> {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede gestionar el personal.",
    emailNotVerified: "Verificá tu email para gestionar el personal.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return { business: { id: auth.business.id, slug: auth.business.slug } };
}

/**
 * Spec 0086 §3 — EL GUARD DE `/api/staff/*`: el permiso `staff`, o sea el perfil
 * ADMINISTRADOR del ADR 0079 §3.
 *
 * **Devuelve `userId` y `role` ademas del negocio, y no es decoracion**: las tres superficies
 * de escritura de este dominio los necesitan para R1 (¿el caller puede otorgar `staff`?) y
 * R3 (¿se esta editando a si mismo?).
 *
 * **NO reemplaza a {@link requireStaffOwner}, que queda INTACTA**: `PATCH
 * /api/merchant/business/slug` la importa desde acá y es una de las CUATRO superficies de la
 * CUENTA que el ADR 0079 §8 deja fuera de todo toggle. Cambiar `requireStaffOwner` en el
 * lugar habria delegado el slug publico del negocio —que es el login de todo el equipo a la
 * vez— con el permiso `staff`, **sin que una sola linea de esa ruta cambiara**. Por eso son
 * dos funciones y no una.
 */
export async function requireStaffAccess(request: Request): Promise<
  | {
      business: { id: string; slug: string };
      userId: string;
      role: string;
    }
  | { response: NextResponse }
> {
  const auth = await requireApiPermission(request, "staff", {
    missingPermission: "No tienes permiso para gestionar el personal.",
    emailNotVerified: "Verificá tu email para gestionar el personal.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return {
    business: { id: auth.business.id, slug: auth.business.slug },
    userId: auth.userId,
    role: auth.role,
  };
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
