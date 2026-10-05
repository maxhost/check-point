import { NextResponse } from "next/server";
import { parseUuid } from "@mi-pasaporte/domain/server/counter/core";
import { PlacesError } from "./google";

/**
 * Spec 0155 — lo comun a `POST /api/places/autocomplete` y `/details` (contrato P1/P2):
 * leer el cuerpo, validar la sesion de busqueda y traducir errores a `{ error, code }`.
 */
export class PlacesInputError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PlacesInputError";
  }
}

const invalidInput = (message: string) =>
  new PlacesInputError(400, "invalid_input", message);

/** El cuerpo como objeto; cualquier otra cosa es `400 invalid_input`. */
export async function readObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw invalidInput("El cuerpo no es válido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw invalidInput("El cuerpo no es válido.");
  return body as Record<string, unknown>;
}

/** El `sessionToken` de Google: un UUID que genera el cliente. Mismo validador del repo. */
export function parseSessionToken(value: unknown): string {
  try {
    return parseUuid(value, "sessionToken");
  } catch {
    throw invalidInput("La sesión de búsqueda no es válida.");
  }
}

const coordinate = (raw: string | null) => {
  if (!raw || !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/**
 * El sesgo del autocomplete: la ubicacion APROXIMADA del visitante que Vercel pone en las
 * cabeceras. Las dos coordenadas o ninguna: media posicion no sesga nada.
 */
export function ipBias(
  headers: Headers,
): { latitude: number; longitude: number } | null {
  const latitude = coordinate(headers.get("x-vercel-ip-latitude"));
  const longitude = coordinate(headers.get("x-vercel-ip-longitude"));
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

const PLACES_MESSAGES = {
  places_unavailable:
    "No pudimos buscar en este momento. Intenta de nuevo en un rato.",
  place_not_found: "No encontramos ese lugar. Búscalo de nuevo.",
} as const;

export function placesErrorResponse(error: unknown): NextResponse {
  if (error instanceof PlacesInputError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  if (error instanceof PlacesError)
    return NextResponse.json(
      { error: PLACES_MESSAGES[error.code], code: error.code },
      { status: error.code === "place_not_found" ? 404 : 503 },
    );
  console.error("places_route_failed", {
    name: error instanceof Error ? error.name : typeof error,
  });
  return NextResponse.json(
    { error: PLACES_MESSAGES.places_unavailable, code: "places_unavailable" },
    { status: 503 },
  );
}
