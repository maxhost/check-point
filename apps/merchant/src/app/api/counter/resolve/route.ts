import { NextResponse } from "next/server";
import { resolveScan } from "../../../../server/counter";
import { counterError, readJson, requireOperator } from "../_auth";
import {
  CounterError,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";

export const runtime = "nodejs";

function optionalLocationId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string")
    throw new CounterError(422, "invalid_input", "El local no es válido.");
  return parseUuid(value, "locationId");
}

/** Resolves a scanned QR to the consumer + this business's program + membership
 * (auto-enrolling if needed). Never serializes the qr_token. */
export async function POST(request: Request) {
  const auth = await requireOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const body = await readJson(request);
    const locationId = optionalLocationId(body.locationId);
    const result = await resolveScan(
      auth.business,
      body.qrToken as string,
      locationId,
    );
    return NextResponse.json(result);
  } catch (error) {
    return counterError(error, "No pudimos resolver el código.");
  }
}
