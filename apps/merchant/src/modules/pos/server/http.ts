import { NextResponse } from "next/server";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
import type { ModuleRoute } from "../../route-table";
import { PosError } from "./errors";

/**
 * Spec 0169 / 0220 — LA FORMA HTTP DE LOS ERRORES DEL POS bajo `/api/modules/pos/…`. El guard
 * (permiso `pos` → modulo encendido, o `owner: true`) lo aplica el despachador del core
 * (`modules/dispatch.ts`); aca solo se traduce lo que el dominio tira.
 *
 * El POS reusa los escritores del mostrador, que tiran `CounterError`: sale como
 * `{ error, code }` con su status, y un `PosError` suma su `extra` (`openCount`, `order`). Cualquier
 * otro error sigue al despachador, que contesta 503 con el `failure` de la ruta (y un `ModuleError`,
 * p. ej. `module_disabled` de `lockModuleEnabled`, con su status y code).
 */
export function posErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof CounterError)) return null;
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
      ...(error instanceof PosError ? error.extra : {}),
    },
    { status: error.status },
  );
}

/** Cutover: dispatcher guard → required scope → contract2 → body/domain. */
export function posRoute(route: ModuleRoute): ModuleRoute {
  return {
    ...route,
    backofficeScope: "required",
    handler: async (context) => {
      try {
        posReadContract(context.request);
        return await route.handler(context);
      } catch (error) {
        const response = posErrorResponse(error);
        if (response) return response;
        throw error;
      }
    },
  };
}

export async function readPosBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new CounterError(
      400,
      "invalid_body",
      "El cuerpo de la solicitud no es válido.",
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CounterError(400, "invalid_body", "El cuerpo no es válido.");
  }
  return body as Record<string, unknown>;
}

/** Called inside the route handler, after dispatcher guard and scope validation. */
export function posReadContract(request: Request): 2 {
  const value = request.headers.get("X-Pos-Contract");
  if (value === "2") return 2;
  throw new CounterError(
    409,
    "pos_client_upgrade_required",
    "Actualiza la aplicación para continuar con el POS.",
  );
}
