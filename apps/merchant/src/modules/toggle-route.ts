import { NextResponse } from "next/server";
import { apiOwnerFailureResponse, requireApiOwner } from "../server/api-owner";
import { setModuleEnabled } from "./activation";
import { moduleErrorResponse, readModuleBody } from "./errors";

/**
 * Spec 0210 — EL HANDLER de `PUT /api/modules/:moduleId` (`{ enabled }` → `200 { module }`), solo
 * del owner (ADR 0138 §4).
 *
 * Vive aca y no en `app/api/modules/[moduleId]/route.ts` porque Next resuelve un segmento estatico
 * ANTES que el dinamico: un modulo con ruta base propia (`app/api/modules/recipes/route.ts`, el
 * `GET` de las recetas) le gana a `[moduleId]` para `/api/modules/recipes`, y sin un `PUT` ahi
 * encender Recetas daba 405 (medido contra `next dev`). Esa ruta base re-exporta este handler con
 * su id fijo; `toggle-route.test.ts` exige que toda ruta base de un modulo del registro lo haga.
 */
export async function putModule(
  request: Request,
  moduleId: string,
): Promise<NextResponse> {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el dueño puede activar o desactivar módulos.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    const updated = await setModuleEnabled(
      auth.business.id,
      moduleId,
      await readModuleBody(request),
    );
    return NextResponse.json({ module: updated });
  } catch (error) {
    return moduleErrorResponse(error, "No pudimos cambiar el módulo.");
  }
}
