import { NextResponse } from "next/server";
import {
  type PermissionScope,
  hasScope,
} from "@mi-pasaporte/db/permissions-catalog";
import { getMerchantAuth } from "./auth";
import { businessStatusFailure } from "./api-owner";
import { type OperatorBusiness, operatorBusiness } from "./counter";

/**
 * LA ESCALERA DEL OPERADOR, compartida por el mostrador (`requireOperator`, scope `counter`) y
 * el POS (`requirePosOperator`, scope `pos`, spec 0169). Antes vivia entera en
 * `app/api/counter/_auth.ts`; se extrajo SIN cambiar el comportamiento del mostrador para que
 * las dos superficies no puedan divergir en el orden de los guards (ADR 0073 §1):
 *
 * ```
 * 1. ¿hay sesion?                 → 401
 * 2. ¿es miembro ACTIVO?          → 403 «Sin negocio.»
 * 3. ¿tiene el permiso del scope? → 403 missing_permission
 * 4. owner con email sin verificar → 403 email_not_verified
 * 5. ¿el negocio OPERA?           → 403 business_suspended | business_closed
 * ```
 *
 * Lo unico que cambia entre superficies es el scope y la COPIA de los dos mensajes propios: el
 * `code` es el contrato, el `error` es copia.
 */
export type OperatorCopy = {
  missingPermission: string;
  emailNotVerified: string;
};

export type OperatorGuardResult =
  { business: OperatorBusiness; userId: string } | { response: NextResponse };

export async function resolveOperator(
  request: Request,
  scope: PermissionScope,
  copy: OperatorCopy,
): Promise<OperatorGuardResult> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return {
      response: NextResponse.json({ error: "No autorizado." }, { status: 401 }),
    };
  }
  const operator = await operatorBusiness(session.user.id);
  if (!operator) {
    return {
      response: NextResponse.json({ error: "Sin negocio." }, { status: 403 }),
    };
  }
  const { business, role } = operator;
  /**
   * EL PERMISO DEL SCOPE (spec 0086 §6 / ADR 0079 §1). Para el mostrador **es un CAMBIO DE
   * COMPORTAMIENTO** de la 0086: hasta esa spec alcanzaba con ser miembro del negocio para
   * acreditar, y ahora hace falta el toggle. Es decision textual del owner: *«puede que el
   * merchant quiera que un solo staff se encargue de eso»*. Por eso la migracion 0041 **borra**
   * las membresias de staff existentes en vez de backfillearlas.
   *
   * `hasScope` es la MISMA decision pura que evalua el paso 3 de `requireApiPermission`, asi
   * que el mostrador, el POS y las superficies delegables no pueden divergir. El **owner nunca
   * lo necesita** (`hasScope` lo deja pasar sin mirar la columna, ADR 0079 §4).
   *
   * Va ANTES del gate de email y del eje `status` por el mismo orden del ADR 0073 §1 que
   * usan las otras superficies: quien no tiene el permiso no se entera del estado del negocio.
   */
  if (!hasScope(role, operator.permissions, scope)) {
    return {
      response: NextResponse.json(
        { error: copy.missingPermission, code: "missing_permission" },
        { status: 403 },
      ),
    };
  }
  /**
   * EL GATE DE EMAIL (spec 0082 §2, decisión textual del owner del 2026-09-19: *«mostrador,
   * tambien entra en cualquier accion requiere verificar email»*). Sacada la puerta del
   * backoffice, un owner sin verificar acreditaría sellos.
   *
   * **`role === "owner"` NO es una optimización, es la trampa central**: el staff no tiene
   * email por diseño (su `user` lleva un sintético `@staff.invalid` que nunca se entrega,
   * spec 0067 §4), así que un gate que lo alcanzara dejaría la superficie muerta PARA SIEMPRE.
   *
   * **`!== true`, no `!`**: un `undefined` —una fila vieja, un doble incompleto— cierra en
   * vez de abrir (fail-closed en el dato).
   *
   * **Va ANTES del eje `status`**, el orden del ADR 0073 §1 que ya usan `requireApiOwner` y
   * `requireBackofficeSession`. Consecuencia declarada y pinneada: un owner sin verificar
   * sobre un negocio `suspended` recibe `email_not_verified`, no `business_suspended`.
   */
  if (role === "owner" && session.user.emailVerified !== true) {
    return {
      response: NextResponse.json(
        { error: copy.emailNotVerified, code: "email_not_verified" },
        { status: 403 },
      ),
    };
  }
  /**
   * EL EJE `status` (spec 0072 §D4), y **por qué acá y no sólo en el login**: `auth.ts` no
   * pisa `session.expiresIn`, así que rige el default de better-auth —7 días—. Un integrante
   * con la sesión ya abierta seguiría operando **una semana entera** después de que el negocio
   * se suspenda o se cierre. Cerrar la puerta no expulsa a quien ya entró.
   *
   * `reasonVisible: false` — el motivo de la suspensión se serializa SOLO al owner (§D4), y
   * estas superficies las opera también el staff.
   */
  const failure = businessStatusFailure(business.status, null, false);
  if (failure) {
    return {
      response: NextResponse.json(
        { error: failure.message, code: failure.code },
        { status: failure.status },
      ),
    };
  }
  return { business, userId: session.user.id };
}
