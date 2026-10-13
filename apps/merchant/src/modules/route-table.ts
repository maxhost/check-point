/**
 * Spec 0216 / ADR 0139 §3 — LA TABLA DE RUTAS DE API DE UN MODULO y como se busca una ruta en ella.
 * Puro: lo usan `modules/<id>/server/routes.ts` (que declaran la tabla), el despachador y los tests.
 */

export type ModuleMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ModuleRouteContext = {
  request: Request;
  business: { id: string };
  userId: string;
  /** Los `:param` del patron, ya decodificados por Next. */
  params: Record<string, string>;
};

export type ModuleRoute = {
  method: ModuleMethod;
  /** Relativo a `/api/modules/<id>/`: segmentos literales y `:param` (`items/:itemId/purchases`);
   * `""` es la ruta base del modulo (un `PUT` ahi no se puede declarar: es el toggle del core). */
  path: string;
  /** El permiso que exige la ruta. Por defecto, el primero que declara el manifiesto. */
  permission?: string;
  /** El mensaje del 503 si el handler falla con algo que no es un `ModuleError`. */
  failure: string;
  handler: (context: ModuleRouteContext) => Promise<Response>;
};

export type RouteMatch =
  | { kind: "found"; route: ModuleRoute; params: Record<string, string> }
  | { kind: "method_not_allowed"; allow: ModuleMethod[] }
  | { kind: "not_found" };

function matchPattern(
  pattern: string,
  segments: readonly string[],
): Record<string, string> | null {
  const parts = pattern === "" ? [] : pattern.split("/");
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const segment = segments[i];
    if (part.startsWith(":")) {
      if (!segment) return null;
      params[part.slice(1)] = segment;
    } else if (part !== segment) {
      return null;
    }
  }
  return params;
}

/** La primera ruta de la tabla cuyo patron y metodo coinciden. Si el patron coincide con otro
 * metodo → `method_not_allowed` (405); si ningun patron coincide → `not_found` (404). */
export function matchRoute(
  routes: readonly ModuleRoute[],
  method: string,
  segments: readonly string[],
): RouteMatch {
  const allow: ModuleMethod[] = [];
  for (const route of routes) {
    const params = matchPattern(route.path, segments);
    if (!params) continue;
    if (route.method === method) return { kind: "found", route, params };
    allow.push(route.method);
  }
  return allow.length > 0
    ? { kind: "method_not_allowed", allow }
    : { kind: "not_found" };
}
