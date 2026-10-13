import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../server/api-owner";
import { requireApiMember } from "../../../server/api-member";
import { listModules } from "../../../modules/activation";
import { moduleErrorResponse } from "../../../modules/errors";

export const dynamic = "force-dynamic";

/**
 * `GET /api/modules` — spec 0210 / 0216, ADR 0138 y 0139 §6: los modulos del registro, en su orden,
 * con `enabled` y `suggested` para el negocio de la sesion, y lo que cada uno declara para el menu
 * (`navigation`) y el selector de permisos (`permissions`).
 *
 * GUARD: CUALQUIER integrante activo del negocio (`requireApiMember`, spec 0216): el menu de un
 * integrante sin `catalog` tambien necesita saber que modulos estan encendidos.
 */
export async function GET(request: Request) {
  const auth = await requireApiMember(request, {
    emailNotVerified: "Verifica tu email para ver los módulos.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    return NextResponse.json({ modules: await listModules(auth.business.id) });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos leer los módulos.");
  }
}
