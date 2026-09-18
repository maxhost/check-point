import { NextResponse } from "next/server";
import { getMerchantAuth } from "./auth";
import { ownerContext } from "./staff";
import {
  API_OWNER_CODES,
  type ApiOwnerFailure,
  businessStatusFailure,
  DEFAULT_MESSAGES,
} from "./business-status";

/** Re-exportados desde la HOJA `business-status.ts`, para que los 12 consumidores de este
 * modulo no cambien su import. El docblock de ese archivo explica por que la decision pura no
 * puede vivir aca: la necesita `server/loyalty-program.ts`, y este modulo arrastra
 * `next/server` y better-auth. */
export {
  API_OWNER_CODES,
  type ApiOwnerFailure,
  businessStatusFailure,
} from "./business-status";

/**
 * Spec 0072 §D3 / ADR 0073 §1 — **EL** resolvedor de owner de las 10 superficies de API.
 *
 * Antes de esta spec habia SEIS resolvedores (uno por dominio) mas cuatro sitios que
 * resolvian owner a mano con `getSession` + `ownerBusiness`, y **solo uno chequeaba el
 * email verificado**. La consecuencia medida: un owner con el email sin verificar creaba
 * sucursales, subia marca, armaba campañas, cargaba catalogo, editaba el programa de
 * fidelizacion y **abria un checkout de Stripe**. Ademas los tres `ownerBusiness` no
 * filtraban `memberships.status='active'`, que `ownerContext` si filtra.
 *
 * **EL ORDEN DE EVALUACION ES LA REGLA, NO UNA OPTIMIZACION** (ADR 0073 §1):
 *
 * ```
 * 1. ¿hay sesion?        → 401 unauthorized
 * 2. ¿es owner activo?   → 403 not_owner
 * 3. ¿email verificado?  → 403 email_not_verified
 * 4. ¿el negocio OPERA?  → 403 business_suspended | business_closed
 * ```
 *
 * Los pasos 3 y 4 van **despues** de resolver al owner: puestos antes, un INTEGRANTE
 * recibiria `email_not_verified` en vez de `not_owner` —lo cazo un test de la spec 0067— y
 * un tercero podria sondear el estado de un negocio ajeno. Es la mutacion M3.
 *
 * **El eje `plan` NO se evalua aca** (paso 5 del ADR): eso es `can()` / `limitOf()`, y vive
 * en la transaccion que escribe. Mezclarlos haria que la superficie diga «mejora tu plan» a
 * un negocio suspendido.
 */

/** El negocio del owner, con las dos columnas del eje `status`. Es la fila de
 * `ownerContext`, o sea **el mismo `innerJoin(businesses)` que ya existia**: leer `status`
 * no agrega una consulta. */
export type ApiOwnerBusiness = {
  id: string;
  slug: string;
  currencyCode: string;
  status: string;
  suspensionReason: string | null;
};

export type ApiOwnerResult =
  | { business: ApiOwnerBusiness; userId: string }
  | { failure: ApiOwnerFailure };

/** Mensajes por defecto. Cada `_auth.ts` puede pisar el de `not_owner` y el de
 * `email_not_verified` con la copia de su dominio: el `code` es el contrato, el `error` es
 * copia. */
export type ApiOwnerMessages = {
  notOwner?: string;
  emailNotVerified?: string;
};

export async function requireApiOwner(
  request: Request,
  messages: ApiOwnerMessages = {},
): Promise<ApiOwnerResult> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return {
      failure: {
        status: 401,
        code: API_OWNER_CODES.unauthorized,
        message: DEFAULT_MESSAGES.unauthorized,
      },
    };
  }

  // PASO 2 — owner ACTIVO. `ownerContext` filtra `role='owner'` y
  // `memberships.status='active'`, que es lo que los tres `ownerBusiness` no hacian.
  const business = await ownerContext(session.user.id);
  if (!business) {
    return {
      failure: {
        status: 403,
        code: API_OWNER_CODES.notOwner,
        message: messages.notOwner ?? DEFAULT_MESSAGES.notOwner,
      },
    };
  }

  // PASO 3 — el email. `!== true` y no `!`: un `undefined` cierra en vez de abrir
  // (fail-closed). Va DESPUES del paso 2 — ver el docblock del modulo.
  if (session.user.emailVerified !== true) {
    return {
      failure: {
        status: 403,
        code: API_OWNER_CODES.emailNotVerified,
        message: messages.emailNotVerified ?? DEFAULT_MESSAGES.emailNotVerified,
      },
    };
  }

  // PASO 4 — el eje `status` (spec 0072 §P3). La columna esta en produccion desde la
  // migracion 0036 y hasta esta spec **no la leia ningun guard**.
  const failure = businessStatusFailure(
    business.status,
    business.suspensionReason,
  );
  if (failure) return { failure };

  return { business, userId: session.user.id };
}

/**
 * `{ error, code, suspensionReason? }` — la forma normalizada de los 401/403 del owner.
 *
 * El motivo viaja como `suspensionReason` (camelCase, la convencion de este API:
 * `archiveCount`, `deactivateCount`, `retryAfterSeconds`); la spec lo nombra por su columna,
 * `suspension_reason`. La clave esta declarada en `0072-contratos-de-api.md`.
 */
export function apiOwnerFailureResponse(
  failure: ApiOwnerFailure,
): NextResponse {
  return NextResponse.json(
    {
      error: failure.message,
      code: failure.code,
      ...(failure.reason === undefined
        ? {}
        : { suspensionReason: failure.reason }),
    },
    { status: failure.status },
  );
}
