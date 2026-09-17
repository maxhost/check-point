import { NextResponse } from "next/server";
import { listStaff } from "../../../server/staff";
import { createStaff } from "../../../server/staff-create";
import { requireStaffOwner, staffError } from "./_auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/staff — el owner lista a su equipo (spec 0068 §1). Es lo que vuelve alcanzables
 * a `…/status` y `…/pin/regenerate` para un integrante creado en otra sesión: hasta ahora
 * su `userId` salía **solo** del 201 del alta.
 *
 * El `businessId` sale de la SESIÓN (`requireStaffOwner`), nunca del cuerpo ni de la query:
 * si viajara, sería un parámetro con el que un owner listaría el equipo de otro.
 *
 * **No setea cookie y no devuelve PIN ni hash** — ni el email sintético, que salió del
 * `StaffDTO` en esta misma spec (§2).
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §2-bis.
 */
export async function GET(request: Request) {
  // El guard va ADENTRO del `try` (spec 0068 §3): resolver la sesión **también consulta la
  // base**, así que afuera un fallo de base saldría como 500 sin `code` en vez del 503 que
  // el contrato declara. El `return auth.response` sigue siendo un return temprano: un
  // 401/403 no es una excepción y no pasa por el `catch`.
  try {
    const auth = await requireStaffOwner(request);
    if ("response" in auth) return auth.response;

    const staff = await listStaff(auth.business.id);
    return NextResponse.json({ staff }, { status: 200 });
  } catch (error) {
    return staffError(error, "No pudimos listar el equipo.");
  }
}

/**
 * POST /api/staff — el owner da de alta un integrante escribiendo **solo el nombre**
 * (spec 0067 §4). El servidor deriva el `handle`, toma el `slug` de la sesion y genera el
 * PIN; el PIN en claro va en ESTA respuesta y en ninguna otra.
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §2.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireStaffOwner(request);
    if ("response" in auth) return auth.response;

    // El `request.json()` conserva su propio `try`: un cuerpo ilegible es 400
    // `invalid_body`, no un 503 de base caída.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo no es válido.", code: "invalid_body" },
        { status: 400 },
      );
    }

    const created = await createStaff(auth.business, body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return staffError(error, "No pudimos crear al integrante.");
  }
}
