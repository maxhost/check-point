import { NextResponse } from "next/server";
import { autocomplete } from "../../../../server/places/google";
import {
  PlacesInputError,
  ipBias,
  parseSessionToken,
  placesErrorResponse,
  readObject,
} from "../../../../server/places/http";

export const dynamic = "force-dynamic";

const MIN_INPUT = 3;
const MAX_INPUT = 120;

/**
 * POST /api/places/autocomplete — contrato P1 de la spec 0155. PUBLICA: el paso 1 del alta
 * no tiene sesion. El costo lo acota la cuota diaria de Google Cloud (limite declarado en
 * la spec; PARQUEADO #70), no un limite por IP.
 */
export async function POST(request: Request) {
  try {
    const body = await readObject(request);
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (input.length < MIN_INPUT || input.length > MAX_INPUT)
      throw new PlacesInputError(
        400,
        "invalid_input",
        `Escribe entre ${MIN_INPUT} y ${MAX_INPUT} caracteres.`,
      );
    const sessionToken = parseSessionToken(body.sessionToken);
    const suggestions = await autocomplete({
      input,
      sessionToken,
      bias: ipBias(request.headers),
    });
    return NextResponse.json({ suggestions });
  } catch (error) {
    return placesErrorResponse(error);
  }
}
