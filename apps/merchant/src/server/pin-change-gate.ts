import { STAFF_ENTRY_PATH } from "@mi-pasaporte/domain/server/hosts";
import type { ApiOwnerFailure } from "@mi-pasaporte/domain/server/business-status";

/**
 * Spec 0218 / ADR 0070 §4 — EL CAMBIO DEL PIN TEMPORAL ES OBLIGATORIO, DEL LADO DEL SERVIDOR.
 *
 * Mientras `core.business_membership.pin_must_change = true`, el integrante no usa el panel con el
 * PIN que le paso el dueño: las paginas del backoffice lo mandan a la pantalla del cambio y la API
 * contesta 403 `pin_change_required`.
 *
 * La DECISION vive aca, una sola vez, y la llaman las tres escaleras de guards que alcanzan al
 * integrante —ninguna ruta la repite—:
 *
 * - `memberLadder` / `requireApiPermissionSinGateDeEmail` (`api-permission.ts`): las superficies
 *   delegables, `requireApiMember` y el despachador de modulos;
 * - `resolveOperator` (`operator-guard.ts`): el mostrador y el POS;
 * - `requireBackofficeSession` (`auth-guards.ts`): todas las paginas del backoffice.
 *
 * `requireApiOwner` no la llama: el integrante muere antes con `not_owner` (no hay camino del
 * staff que atraviese esa escalera).
 *
 * Lo que queda AFUERA por construccion, y es lo que la spec exceptua: `POST /api/staff/:id/pin`
 * (el propio cambio, con su sesion leida a mano), `GET /api/merchant/session` (un reportero, no
 * un guard) y el cierre de sesion (`/api/auth/sign-out`, de better-auth).
 *
 * En cada escalera va como ULTIMO paso, despues del eje `status` y del de cobro: la compuerta
 * solo decide cuando todo lo demas habria dejado pasar, asi que un integrante de un negocio
 * suspendido sigue recibiendo `business_suspended` (no se le pide un cambio que no lo dejaria
 * entrar igual) y ningun camino exitoso la saltea.
 */

export const PIN_CHANGE_REQUIRED = "pin_change_required";

export const PIN_CHANGE_MESSAGE = "Cambia tu PIN temporal para continuar.";

/** La pantalla del cambio: la del ingreso del equipo con `?cambiar-pin=1` (la construye GPT). */
export const PIN_CHANGE_PAGE = `${STAFF_ENTRY_PATH}?cambiar-pin=1`;

/**
 * ¿Tiene que cambiar el PIN antes de seguir? **El owner NUNCA** —no tiene PIN, y su fila nace
 * con `pin_must_change = true` por el default de la columna, asi que el rol no es una
 * optimizacion: sin el, todo dueño quedaria encerrado—.
 *
 * `=== true`: la columna es `NOT NULL` (`schema/membership.ts`), asi que la base solo devuelve
 * `true` o `false`.
 */
export function pinChangeRequired(member: {
  role: string;
  pinMustChange?: boolean | null;
}): boolean {
  return member.role !== "owner" && member.pinMustChange === true;
}

/** El 403 de la API, con la forma de los demas fallos de la escalera. */
export function pinChangeFailure(member: {
  role: string;
  pinMustChange?: boolean | null;
}): ApiOwnerFailure | null {
  if (!pinChangeRequired(member)) return null;
  return {
    status: 403,
    code: PIN_CHANGE_REQUIRED,
    message: PIN_CHANGE_MESSAGE,
  };
}
