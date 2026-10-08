import { NextResponse } from "next/server";
import {
  CounterError,
  pgErrorCode,
} from "@mi-pasaporte/domain/server/counter/core";
import { type OperatorGuardResult, resolveOperator } from "../operator-guard";
import { PosError, posDisabled } from "./errors";
import { readPosEnabled } from "./module";

/**
 * Spec 0169 §Autorizacion — EL GUARD DE TODAS LAS RUTAS `/api/pos/*`.
 *
 * La MISMA escalera que el mostrador (`server/operator-guard.ts`: sesion → miembro activo →
 * permiso → gate de email del owner → eje `status`) con el scope `pos` en vez de `counter`, y
 * despues, el MODULO: `pos_enabled !== true` → 403 `pos_disabled`, para el owner y para el staff.
 *
 * El modulo va AL FINAL y no antes del permiso: un staff sin `pos` recibe `missing_permission`
 * (no se entera de si el comercio tiene el modulo), y un negocio suspendido contesta por su
 * `status` antes que por un modulo que de todos modos no podria usar. `!== true` y no `!`:
 * fail-closed en el dato.
 *
 * El modulo tambien se relee bajo lock al CREAR (`module.ts`); este guard es el que corta las
 * LECTURAS y el resto de las escrituras cuando el owner lo apaga.
 */
export async function requirePosOperator(
  request: Request,
): Promise<OperatorGuardResult> {
  const result = await resolveOperator(request, "pos", {
    missingPermission: "No tienes permiso para operar el POS.",
    emailNotVerified: "Verifica tu email para operar el POS.",
  });
  if ("response" in result) return result;
  if ((await readPosEnabled(result.business.id)) !== true) {
    const error = posDisabled();
    return {
      response: NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      ),
    };
  }
  return result;
}

/** `{ error, code }` como el mostrador; un `PosError` suma su `extra` (`openCount`, `order`). */
export function posError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CounterError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error instanceof PosError ? error.extra : {}),
      },
      { status: error.status },
    );
  }
  console.error("pos_route_failed", {
    name: error instanceof Error ? error.name : typeof error,
    // El SQLSTATE recorriendo `.cause` (drizzle envuelve el error de pg); nunca el mensaje.
    code: pgErrorCode(error),
  });
  return NextResponse.json({ error: fallback }, { status: 503 });
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
