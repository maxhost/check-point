import {
  backofficeScopeFailure,
  privateBackofficeResponse,
} from "../server/backoffice-scope-http";
import { NextResponse } from "next/server";
import { apiOwnerFailureResponse, requireApiOwner } from "../server/api-owner";
import { setModuleEnabled } from "./activation";
import { moduleErrorResponse, readModuleBody } from "./errors";
import { requireModuleAccess, requireModuleOwnerAccess } from "./guard";
import { moduleById } from "./registry";
import { type ModuleRoute, matchRoute } from "./route-table";
import { SERVER_MODULES } from "./server-registry";
import type { ModuleManifest } from "./contract";

/**
 * Spec 0216 / ADR 0139 §4 — EL DESPACHADOR DE `/api/modules/<id>/…`. Nunca nombra un modulo: le
 * pregunta al registro y a la tabla de rutas del modulo (`server-registry.ts`).
 *
 * - `PUT /api/modules/<id>` (sin `path`): el TOGGLE del core, solo del owner (ADR 0138 §4). Como
 *   todo `/api/modules/<id>` cae aca, ya no hay ruta estatica de un modulo que le gane a
 *   `[moduleId]` (la trampa del 405 que resolvia `toggle-route.ts`, spec 0210).
 * - Cualquier otro caso: modulo del registro (si no, 404 `module_not_found`) → ruta de su tabla
 *   (404 `route_not_found`; 405 si el patron existe con otro metodo) → permiso de la ruta (por
 *   defecto el del modulo) → modulo encendido (403 `module_disabled`) → handler. El orden
 *   permiso → modulo es el de siempre: un integrante sin el permiso recibe `missing_permission`
 *   sin enterarse de que modulos tiene el comercio.
 * - Spec 0220 / ADR 0141 §7: una ruta `owner: true` cambia el permiso por `requireApiOwner`
 *   (integrante → 403 `not_owner`), y despues el modulo encendido.
 */

export type DispatchParams = { moduleId: string; path?: string[] };

function notFound(code: string, error: string): NextResponse {
  return NextResponse.json({ error, code }, { status: 404 });
}

function methodNotAllowed(allow: readonly string[]): NextResponse {
  return NextResponse.json(
    { error: "Método no permitido.", code: "method_not_allowed" },
    { status: 405, headers: { Allow: allow.join(", ") } },
  );
}

/** El permiso que pide `route`: el suyo, o el primero que declara el manifiesto. */
export function routePermission(
  manifest: ModuleManifest,
  route: ModuleRoute,
): string | null {
  return route.permission ?? manifest.permissions[0]?.id ?? null;
}

async function toggle(request: Request, moduleId: string): Promise<Response> {
  try {
    const auth = await requireApiOwner(request, {
      notOwner: "Solo el dueño puede activar o desactivar módulos.",
    });
    if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
    const scope = await backofficeScopeFailure(request, auth.business.id);
    if (scope) return scope;
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

export async function dispatchModuleRequest(
  method: string,
  request: Request,
  { moduleId, path }: DispatchParams,
): Promise<Response> {
  const segments = path ?? [];
  if (segments.length === 0 && method === "PUT") {
    return privateBackofficeResponse(await toggle(request, moduleId));
  }
  const manifest = moduleById(moduleId);
  const routes =
    manifest && Object.hasOwn(SERVER_MODULES, manifest.id)
      ? SERVER_MODULES[manifest.id].routes
      : null;
  const match = routes ? matchRoute(routes, method, segments) : null;
  if (segments.length === 0 && match?.kind !== "found") {
    // La ruta base es del toggle (`PUT`); otro metodo, solo si el modulo declara su ruta base
    // (`GET /api/modules/recipes`). Si no, 405 como cuando `[moduleId]` solo exportaba `PUT`.
    return methodNotAllowed(
      match?.kind === "method_not_allowed" ? [...match.allow, "PUT"] : ["PUT"],
    );
  }
  if (!manifest || !match) {
    return notFound("module_not_found", "Ese módulo no existe.");
  }
  if (match.kind === "not_found") {
    return notFound("route_not_found", "Esa ruta no existe.");
  }
  if (match.kind === "method_not_allowed") {
    return methodNotAllowed(match.allow);
  }
  const access = match.route.owner
    ? await requireModuleOwnerAccess(request, manifest.id)
    : await permissionAccess(request, manifest, match.route);
  if ("response" in access) return access.response;
  try {
    return await match.route.handler({
      request,
      business: access.business,
      userId: access.userId,
      params: match.params,
    });
  } catch (error) {
    return moduleErrorResponse(error, match.route.failure);
  }
}

async function permissionAccess(
  request: Request,
  manifest: ModuleManifest,
  route: ModuleRoute,
): ReturnType<typeof requireModuleAccess> {
  const permission = routePermission(manifest, route);
  if (!permission) {
    // Un modulo sin permisos y una ruta sin `permission`: error de declaracion, fail-closed
    // (`modules-boundary.test.ts` exige que toda ruta resuelva uno).
    return {
      response: moduleErrorResponse(
        new Error("module_route_without_permission"),
        route.failure,
      ),
    };
  }
  return requireModuleAccess(request, manifest.id, permission);
}
