import { NextResponse } from "next/server";
import { renameStaff } from "../../../../server/staff-rename";
import { requireStaffAccess, staffError } from "../_auth";

export const dynamic = "force-dynamic";

/**
 * `PATCH /api/staff/:userId` — **edita SOLO el nombre** (spec 0087, ADR 0080).
 *
 * **Renombrar RE-DERIVA el identificador**, o sea que cambia con que string entra esa
 * persona. La respuesta trae el `identifier` nuevo **siempre**, aunque no haya cambiado: es
 * la condicion que el ADR 0080 §1 pone para que la decision no sea una trampa silenciosa.
 * A nadie se le notifica nada —el email del integrante es sintetico y no entregable—, asi
 * que mostrarselo al merchant es trabajo de la UI (contrato §1).
 *
 * **`PATCH …/permissions` es OTRA ruta y queda INTACTA.** No se fusionan: las politicas de
 * autorizacion de los dos campos son distintas —al nombre se lo edita uno mismo, a los
 * permisos no— y en un handler unico esas dos politicas conviven en el mismo camino de
 * codigo, donde un refactor que autorice una vez por *request* en vez de una vez por *campo*
 * es una escalada de privilegios. Por eso un cuerpo con la clave `permissions` sale con
 * **400 `permissions_not_here`** en vez de ignorarse.
 *
 * Las reglas y los `code` viven en `server/staff-rename.ts` y **no acá**: esta ruta resuelve
 * la sesion, toma el `userId` del path y pasa. El `businessId` sale de la SESION, nunca del
 * cuerpo (ADR 0070 §15.3).
 *
 * Contrato: `docs/specs/0087-contratos-de-api.md` §2.
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo no es válido.", code: "invalid_body" },
        { status: 400 },
      );
    }

    const staff = await renameStaff(auth.business, userId, body);
    return NextResponse.json({ staff }, { status: 200 });
  } catch (error) {
    return staffError(error, "No pudimos actualizar al integrante.");
  }
}
