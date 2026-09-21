import { NextResponse } from "next/server";
import { setStaffStatus } from "../../../../../server/staff";
import { requireStaffAccess, staffError } from "../../_auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/staff/:userId/status — activa o desactiva a un integrante.
 *
 * **Delegable con el permiso `staff`** desde la spec 0086, y es decision TEXTUAL del owner
 * (ADR 0079 §2): *«deberia poder desactivar tambien porque esto no es destructivo»* —
 * desactivar es REVERSIBLE y preserva identidad y auditoria (ADR 0044 §2). `setStaffStatus`
 * ya corta con `409 target_is_owner` si el target es el owner (R4).
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §4-bis (su fila la agrega la spec 0068).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // El guard va ADENTRO del `try` (spec 0068 §3): la resolución de la sesión también
  // consulta la base, y afuera un fallo de base salía 500 sin `code` en vez del 503 que el
  // contrato declara. El `return auth.response` sigue siendo un return temprano.
  try {
    const auth = await requireStaffAccess(request);
    if ("response" in auth) return auth.response;

    const { userId } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "El cuerpo no es válido." },
        { status: 400 },
      );
    }

    const staff = await setStaffStatus(
      auth.business,
      // El rol sale del GUARD, nunca del cuerpo (R5: un no-owner no da de baja a un
      // administrador).
      auth.role,
      userId,
      body.status,
    );
    return NextResponse.json({ staff }, { status: 200 });
  } catch (error) {
    return staffError(error, "No pudimos actualizar el estado.");
  }
}
