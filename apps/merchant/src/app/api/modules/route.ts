import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../server/api-owner";
import { requireApiPermission } from "../../../server/api-permission";
import { listModules } from "../../../modules/activation";
import { moduleErrorResponse } from "../../../modules/errors";

export const dynamic = "force-dynamic";

/**
 * `GET /api/modules` — spec 0210 / ADR 0138: los modulos del registro, en su orden, con `enabled` y
 * `suggested` para el negocio de la sesion.
 *
 * GUARD: el merchant no tiene un guard de API para «cualquier miembro sin permiso especifico» (las
 * escaleras existentes —`requireApiPermission`, `requireApiOwner`, `requirePosOperator`— piden un
 * alcance o el rol owner), asi que va el fallback de la spec: `requireApiPermission(request,
 * "catalog")`, el mismo permiso con el que operan Stock y Recetas.
 */
export async function GET(request: Request) {
  const auth = await requireApiPermission(request, "catalog", {
    missingPermission: "No tienes permiso para ver los módulos.",
    emailNotVerified: "Verifica tu email para ver los módulos.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    return NextResponse.json({ modules: await listModules(auth.business.id) });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos leer los módulos.");
  }
}
