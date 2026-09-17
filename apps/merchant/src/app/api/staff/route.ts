import { NextResponse } from "next/server";
import { createStaff } from "../../../server/staff-create";
import { requireStaffOwner, staffError } from "./_auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff — el owner da de alta un integrante escribiendo **solo el nombre**
 * (spec 0067 §4). El servidor deriva el `handle`, toma el `slug` de la sesion y genera el
 * PIN; el PIN en claro va en ESTA respuesta y en ninguna otra.
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §2.
 */
export async function POST(request: Request) {
  const auth = await requireStaffOwner(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo no es válido.", code: "invalid_body" },
      { status: 400 },
    );
  }

  try {
    const created = await createStaff(auth.business, body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return staffError(error, "No pudimos crear al integrante.");
  }
}
