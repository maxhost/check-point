import { NextResponse } from "next/server";
import {
  CounterError,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import { resolveScan } from "../../../../server/counter";
import {
  posError,
  readPosBody,
  requirePosOperator,
} from "../../../../server/pos/auth";

export const runtime = "nodejs";

function optionalLocationId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string")
    throw new CounterError(422, "invalid_input", "El local no es válido.");
  return parseUuid(value, "locationId");
}

/** `POST /api/pos/resolve` (spec 0169): el escaneo del pase al cobrar — la MISMA resolucion que
 * `POST /api/counter/resolve` (`resolveScan`), detras del guard del POS. */
export async function POST(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readPosBody(request);
    const result = await resolveScan(
      auth.business,
      body.qrToken as string,
      optionalLocationId(body.locationId),
    );
    return NextResponse.json(result);
  } catch (error) {
    return posError(error, "No pudimos resolver el código.");
  }
}
