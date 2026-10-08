import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../../../server/api-owner";
import { posError, readPosBody } from "../../../../../server/pos/auth";
import { setPosEnabled } from "../../../../../server/pos/module";

export const dynamic = "force-dynamic";

/**
 * `PUT /api/merchant/business/pos` (spec 0169, owner): `{ enabled }` → `{ enabled }`. Encender no
 * tiene condicion; apagar con ordenes abiertas → 409 `pos_has_open_orders` con `openCount`.
 * El negocio sale de la SESION (`requireApiOwner`), nunca del cuerpo.
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireApiOwner(request);
    if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
    const body = await readPosBody(request);
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Indica si el POS queda activado.", code: "invalid_input" },
        { status: 422 },
      );
    }
    return NextResponse.json(
      await setPosEnabled(auth.business.id, body.enabled),
    );
  } catch (error) {
    return posError(error, "No pudimos cambiar el POS.");
  }
}
