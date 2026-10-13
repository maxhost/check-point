import { NextResponse } from "next/server";
import { pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";

/**
 * Spec 0210 — el error de las rutas `/api/modules/**`: `{ error (español), code, ...extra }`. `extra`
 * lleva los campos que el contrato suma a un 409 (`missing`, `dependents`).
 */
export class ModuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ModuleError";
  }
}

export function moduleErrorResponse(
  error: unknown,
  fallback: string,
): NextResponse {
  if (error instanceof ModuleError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...error.extra },
      { status: error.status },
    );
  }
  console.error("module_route_failed", {
    name: error instanceof Error ? error.name : typeof error,
    // El SQLSTATE recorriendo `.cause` (drizzle envuelve el error de pg); nunca el mensaje.
    code: pgErrorCode(error),
  });
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export function invalidBody(message = "El cuerpo no es válido."): ModuleError {
  return new ModuleError(422, "invalid_body", message);
}

/** El cuerpo JSON como objeto plano; cualquier otra cosa es 422 `invalid_body`. */
export async function readModuleBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw invalidBody();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw invalidBody();
  }
  return body as Record<string, unknown>;
}
