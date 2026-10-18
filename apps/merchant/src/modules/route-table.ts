/**
 * Spec 0216 / ADR 0139 §3 — LA TABLA DE RUTAS DE API DE UN MODULO y como se busca una ruta en ella.
 * Puro: lo usan `modules/<id>/server/routes.ts` (que declaran la tabla), el despachador y los tests.
 */
import type { ResourceMeasurementValidator } from "@mi-pasaporte/domain/resource-measurement";
import type { MetricTranslator } from "@mi-pasaporte/domain/analytics/metrics";
import type { DbTransaction } from "@mi-pasaporte/db";
import type { EventSubscription } from "../server/module-events/types";
import type { ModuleError } from "./errors";

export type ModuleMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ModuleRouteContext = {
  request: Request;
  /** ADR 0141 §8: lo que ya trae la escalera de acceso; los handlers no lo vuelven a leer. */
  business: { id: string; currencyCode: string; status: string };
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
  /** ADR 0141 §7 — SOLO EL OWNER: el despachador aplica `requireApiOwner` en vez del permiso, y
   * despues el modulo encendido. Excluye `permission` (`modules-boundary.test.ts`). */
  owner?: true;
  /** ADR0154: guard completo → intención de ámbito → dominio. Ausente no adopta el contrato. */
  backofficeScope?: "optional" | "required";
  /** El mensaje del 503 si el handler falla con algo que no es un `ModuleError`. */
  failure: string;
  handler: (context: ModuleRouteContext) => Promise<Response>;
};

/** ADR 0141 §4 — la regla para no apagarse. La llama el toggle del core al APAGAR, dentro de su
 * transaccion y bajo su lock exclusivo, despues de `module_required_by`. Un error devuelto ES la
 * respuesta; `null` deja apagar. */
export type BeforeDisable = (
  tx: DbTransaction,
  businessId: string,
) => Promise<ModuleError | null>;

/** Lo que un modulo aporta a `server-registry.ts`: sus rutas y, si las tiene, sus reglas. */
export type ModuleServer = {
  routes: readonly ModuleRoute[];
  metricTranslators?: readonly MetricTranslator[];
  onEnable?: (
    tx: DbTransaction,
    context: { businessId: string },
  ) => Promise<void>;
  resourceProviders?: readonly ModuleResourceProvider[];
  resourceMeasurementValidators?: readonly {
    resourceType: string;
    validate: ResourceMeasurementValidator<DbTransaction>;
  }[];
  beforeDisable?: BeforeDisable;
  eventSubscriptions?: readonly EventSubscription[];
};
export type ModuleResource = {
  resourceId: string;
  metadata: Record<string, unknown>;
};
/** Internal metadata only; caller's guard, business and transaction remain authoritative. */
export type ModuleResourceProvider = {
  resourceType: string;
  list?: (
    tx: DbTransaction,
    businessId: string,
  ) => Promise<readonly ModuleResource[]>;
  read: (
    tx: DbTransaction,
    businessId: string,
    resourceIds: readonly string[],
  ) => Promise<readonly ModuleResource[]>;
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
