import { getMerchantAuth } from "./auth";
import { membershipContext } from "./staff";
import { type ApiOwnerBusiness } from "./api-owner";
// Desde la HOJA pura, igual que `api-owner.ts`: `DEFAULT_MESSAGES` no esta entre lo que ese
// modulo re-exporta, y traerlo de acá evita una re-exportacion nueva en un archivo que la
// spec 0075 exige que quede intacto.
import {
  API_OWNER_CODES,
  type ApiOwnerFailure,
  businessStatusFailure,
  DEFAULT_MESSAGES,
} from "./business-status";
import { hasScope, type PermissionScope } from "./permissions-catalog";

/**
 * Spec 0086 §2 / ADR 0079 §5 — **EL** resolvedor de las DIEZ superficies DELEGABLES.
 *
 * **No vive en `api-owner.ts` a proposito**: ese archivo tiene 254 lineas y el limite del
 * hook `file-size` es 300. Dividir, no extender. Y ademas `requireApiOwner` sigue siendo el
 * guard de las CUATRO superficies de la CUENTA (ADR 0079 §8: billing, el slug del negocio, el
 * onboarding y el estado), que no se tocan ni una linea.
 *
 * **LA ESCALERA, Y SU ORDEN ES LA REGLA, NO UNA OPTIMIZACION** (ADR 0073 §1):
 *
 * ```
 * 1. ¿hay sesion?                    → 401 unauthorized
 * 2. ¿membresia ACTIVA del negocio?  → 403 not_member          ← code NUEVO
 * 3. ¿owner, o staff con el scope?   → 403 missing_permission  ← code NUEVO
 * 4. ¿email verificado?              → 403 email_not_verified  ← SOLO si role === 'owner'
 * 5. ¿el negocio OPERA?              → 403 business_suspended | business_closed
 * ```
 *
 * - **Los pasos 4 y 5 van DESPUES de resolver la membresia** por el mismo motivo por el que
 *   ya iban despues de resolver al owner en `requireApiOwner`: puestos antes, filtran
 *   informacion de un negocio ajeno a un tercero. Un no-miembro recibe `not_member` y
 *   **nunca** `business_suspended`. Es la mutacion M2 del presupuesto.
 * - **El paso 3 va DESPUES del 2** y no al reves: quien no es miembro no tiene que enterarse
 *   de que permiso le habria hecho falta.
 * - **El paso 4 saltea al staff**, con el precedente medido de `api/counter/_auth.ts`: el
 *   integrante tiene un email sintetico `@staff.invalid` que nunca se entrega y **ninguna
 *   accion con la que verificar nada**, asi que un gate que lo alcanzara dejaria su
 *   superficie muerta para siempre. `role === 'owner' && emailVerified !== true` — `!== true`
 *   y no `!`, fail-closed en el dato. Es la mutacion M3.
 * - **El paso 5 reusa `businessStatusFailure`**, la misma hoja pura que ya usan
 *   `requireApiOwner`, el login por PIN, el mostrador y `saveProgram`. No se escribe una
 *   segunda escalera del eje `status`.
 *
 * **EL CAMBIO DE CONTRATO:** `not_owner` DESAPARECE de estas diez superficies. Hoy los tres
 * casos —sin membresia, integrante, owner de otro negocio— colapsan en `not_owner`; pasan a
 * ser `not_member` y `missing_permission`. Declarado en `docs/specs/0086-contratos-de-api.md`
 * §7. `not_owner` sobrevive intacto en las cuatro superficies de la CUENTA.
 *
 * **El eje PLAN NO entra aca** (ADR 0073 §1): sigue en la transaccion que escribe, via
 * `can()` / `limitOf()`. `EntitlementContext` sale de la suscripcion del NEGOCIO y **no tiene
 * nocion de usuario**, asi que un staff hereda los topes del owner sin una linea nueva. El
 * invariante a defender es el inverso: este guard **no puede volverse un segundo camino que
 * saltee al writer**.
 */

/** Los dos `code` que esta escalera agrega. Los otros tres los comparte con
 * `API_OWNER_CODES`, que es la misma tabla del contrato 0072. */
export const API_PERMISSION_CODES = {
  notMember: "not_member",
  missingPermission: "missing_permission",
} as const;

export const PERMISSION_DEFAULT_MESSAGES = {
  notMember: "No perteneces a ningún negocio activo.",
  missingPermission: "No tienes permiso para hacer esto.",
} as const;

/** El resultado del guard. `role` y `permissions` viajan porque los necesitan las cuatro
 * reglas anti-escalada del §4 (R1 mira el rol del caller) — no son decoracion. */
export type ApiPermissionResult =
  | {
      business: ApiOwnerBusiness;
      userId: string;
      role: string;
      permissions: string[];
    }
  | { failure: ApiOwnerFailure };

/** Cada `_auth.ts` puede pisar la copia de su dominio; el `code` es el contrato y el `error`
 * es copia que se puede reescribir. */
export type ApiPermissionMessages = {
  notMember?: string;
  missingPermission?: string;
  emailNotVerified?: string;
};

export async function requireApiPermission(
  request: Request,
  scope: PermissionScope,
  messages: ApiPermissionMessages = {},
): Promise<ApiPermissionResult> {
  const resolved = await resolveMembership(request, scope, messages);
  if ("failure" in resolved) return resolved;

  // PASO 4 — el email, y SOLO para el owner. `!== true` y no `!`: un `undefined` cierra en
  // vez de abrir (fail-closed en el dato).
  if (resolved.role === "owner" && resolved.emailVerified !== true) {
    return {
      failure: {
        status: 403,
        code: API_OWNER_CODES.emailNotVerified,
        message: messages.emailNotVerified ?? DEFAULT_MESSAGES.emailNotVerified,
      },
    };
  }

  return statusStep(resolved);
}

/**
 * Spec 0086 §2 — **la hermana sin el paso 4, y existe para DOS rutas**:
 * `GET /api/loyalty-program/qr` y `PUT /api/loyalty-program`.
 *
 * Es la misma escalera **sin el paso 4** y con los pasos 1, 2, 3 y 5 enteros. Existe como
 * funcion propia y no como flag por la razon de la spec 0075 §D1: *un booleano que apaga un
 * gate de seguridad viaja en un copy-paste entre rutas del mismo dominio y no se puede contar
 * con un `rg`.* Un nombre si.
 *
 * **⚠️ INVARIANTE DEL INVENTARIO, y cambio de forma en esta spec:** `rg 'SinGateDeEmail' apps`
 * tiene que seguir devolviendo **exactamente TRES rutas**, ahora repartidas en DOS funciones
 * — el QR y el `PUT` del programa en esta, `GET /api/onboarding/checklist` en
 * `requireApiOwnerSinGateDeEmail`. `api-owner-surfaces.test.ts` asevera ese conjunto como
 * CERRADO. **No se extiende a una cuarta sin volver a discutirlo.**
 *
 * **Y no afloja nada**: desde la spec 0077 el gate de email de la escritura del programa vive
 * en `saveProgram`, que distingue crear de editar. Volver a ponerlo en la puerta dejaria
 * inalcanzable el paso 3 del alta (una cuenta nueva nace con `email_verified = false`).
 */
export async function requireApiPermissionSinGateDeEmail(
  request: Request,
  scope: PermissionScope,
  /** Sin `emailNotVerified`: el tipo hace imposible pasarlo por accidente a una funcion que
   * no evalua ese paso. */
  messages: Omit<ApiPermissionMessages, "emailNotVerified"> = {},
): Promise<ApiPermissionResult> {
  const resolved = await resolveMembership(request, scope, messages);
  if ("failure" in resolved) return resolved;

  // PASO 4 — NO CORRE, a proposito. Es la razon de ser de esta funcion.

  return statusStep(resolved);
}

/** Los pasos 1, 2 y 3, que las dos funciones comparten ENTEROS. Lo unico que las distingue
 * es el paso 4, y por eso es lo unico que queda afuera de esta pieza. */
async function resolveMembership(
  request: Request,
  scope: PermissionScope,
  messages: ApiPermissionMessages,
): Promise<
  | {
      business: ApiOwnerBusiness;
      userId: string;
      role: string;
      permissions: string[];
      emailVerified: boolean;
    }
  | { failure: ApiOwnerFailure }
> {
  // PASO 1 — la sesion.
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

  // PASO 2 — membresia ACTIVA. `membershipContext` filtra `memberships.status='active'` y
  // NO filtra rol: es el gemelo exacto de `ownerContext` salvo por eso.
  const membership = await membershipContext(session.user.id);
  if (!membership) {
    return {
      failure: {
        status: 403,
        code: API_PERMISSION_CODES.notMember,
        message: messages.notMember ?? PERMISSION_DEFAULT_MESSAGES.notMember,
      },
    };
  }

  // PASO 3 — el alcance. La decision es pura y vive en `permissions-catalog.ts`: el owner
  // pasa sin mirar la columna (ADR 0079 §4), el staff necesita el scope en su lista.
  if (!hasScope(membership.role, membership.permissions, scope)) {
    return {
      failure: {
        status: 403,
        code: API_PERMISSION_CODES.missingPermission,
        message:
          messages.missingPermission ??
          PERMISSION_DEFAULT_MESSAGES.missingPermission,
      },
    };
  }

  return {
    business: {
      id: membership.id,
      slug: membership.slug,
      countryCode: membership.countryCode,
      currencyCode: membership.currencyCode,
      status: membership.status,
      suspensionReason: membership.suspensionReason,
    },
    userId: session.user.id,
    role: membership.role,
    permissions: membership.permissions,
    emailVerified: session.user.emailVerified === true,
  };
}

/** PASO 5 — el eje `status`, con `businessStatusFailure`, la MISMA hoja pura de siempre.
 *
 * `reasonVisible` sale del rol: el `suspensionReason` es una nota interna sobre la cuenta y
 * **se serializa solo al owner** (spec 0072 §D4, y `auth-guards.ts` / `session-view.ts` hacen
 * exactamente lo mismo con la misma fila). Un integrante recibe `business_suspended` mudo. */
function statusStep(resolved: {
  business: ApiOwnerBusiness;
  userId: string;
  role: string;
  permissions: string[];
}): ApiPermissionResult {
  const failure = businessStatusFailure(
    resolved.business.status,
    resolved.business.suspensionReason,
    resolved.role === "owner",
  );
  if (failure) return { failure };
  return {
    business: resolved.business,
    userId: resolved.userId,
    role: resolved.role,
    permissions: resolved.permissions,
  };
}
