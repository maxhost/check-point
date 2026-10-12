import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../../../server/api-owner";
import { posError, readPosBody } from "../../../../../server/pos/auth";
import {
  parseTicketSettings,
  readTicketSettings,
  saveTicketSettings,
} from "../../../../../server/ticket-settings/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/merchant/business/ticket` (spec 0184, owner) → `{ printingEnabled, showBusinessName,
 * showTable }`: si el negocio imprime (spec 0206) y que bloques opcionales lleva el ticket impreso del
 * POS. Sin ajuste guardado, los defaults (impresion apagada).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireApiOwner(request);
    if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
    return NextResponse.json(await readTicketSettings(auth.business.id));
  } catch (error) {
    return posError(error, "No pudimos leer el ajuste del ticket.");
  }
}

/**
 * `PUT /api/merchant/business/ticket` (spec 0184 / 0206, owner): `{ printingEnabled,
 * showBusinessName, showTable }`, los tres booleanos y obligatorios en el cuerpo (ninguno obligatorio
 * en `true`) → lo guardado. El negocio
 * sale de la SESION, nunca del cuerpo.
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireApiOwner(request);
    if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
    const settings = parseTicketSettings(await readPosBody(request));
    if (!settings) {
      return NextResponse.json(
        {
          error: "Indica si el negocio imprime tickets y qué bloques muestra.",
          code: "invalid_input",
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      await saveTicketSettings(auth.business.id, settings),
    );
  } catch (error) {
    return posError(error, "No pudimos guardar el ajuste del ticket.");
  }
}
