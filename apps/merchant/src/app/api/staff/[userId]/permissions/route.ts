import { NextResponse } from "next/server";
import { setStaffPermissions } from "../../../../../server/staff-permissions";
import { requireStaffAccess, staffError } from "../../_auth";

export const dynamic = "force-dynamic";

/**
 * `PATCH /api/staff/:userId/permissions` — spec 0086 §5.
 *
 * **Es un REEMPLAZO TOTAL del conjunto, no un delta**: la UI manda el conjunto de toggles que
 * quedo prendido y lo que no viaja se quita. No existe `add`/`remove`. Lista vacia →
 * `400 permissions_required`, porque **quitarle todo a alguien ya tiene nombre y es
 * desactivarlo** (`POST /api/staff/:userId/status`).
 *
 * **Ruta nueva y no `PATCH /api/staff/:userId`**: hoy no existe una ruta de edicion general
 * del integrante, y abrirla arrastraria decidir que mas se edita (el nombre, el handle). Es
 * lo que el contrato §9 deja escrito como «todavia NO».
 *
 * Las cuatro reglas anti-escalada viven en `server/staff-permissions.ts` y **no acá**: esta
 * ruta resuelve la sesion, toma el `userId` del path y pasa. El `businessId` y el `role` del
 * caller salen de la SESION, nunca del cuerpo (ADR 0070 §15.3).
 *
 * Contrato: `docs/specs/0086-contratos-de-api.md` §5.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // El guard va ADENTRO del `try` (spec 0068 §3): resolver la sesion tambien consulta la
  // base, y afuera un fallo de base saldria 500 sin `code` en vez del 503 que el contrato
  // declara. El `return auth.response` sigue siendo un return temprano.
  try {
    const auth = await requireStaffAccess(request);
    if ("response" in auth) return auth.response;

    const { userId } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "El cuerpo no es válido.", code: "invalid_body" },
        { status: 400 },
      );
    }

    const staff = await setStaffPermissions(
      auth.business,
      { userId: auth.userId, role: auth.role },
      userId,
      body?.permissions,
    );
    return NextResponse.json({ staff }, { status: 200 });
  } catch (error) {
    return staffError(error, "No pudimos actualizar los permisos.");
  }
}
