import {
  type ApiPermissionMessages,
  type ApiPermissionResult,
  memberLadder,
} from "./api-permission";

/**
 * Spec 0216 / ADR 0139 §6 — EL GUARD DE «CUALQUIER INTEGRANTE DEL NEGOCIO».
 *
 * La misma escalera que `requireApiPermission` (sesion → membresia ACTIVA → email del owner →
 * `status` del negocio → acceso por cobro), SIN el paso del permiso: un integrante sin ningun
 * alcance especifico igual pertenece al negocio. Lo usa `GET /api/modules`, porque el menu de
 * CUALQUIER integrante necesita saber que modulos estan encendidos para dibujarse.
 *
 * Es una funcion con nombre y no un `requireApiPermission(request, null)`: un guard que no
 * pide permiso se tiene que poder contar con un `rg` (spec 0075 §D1).
 */
export async function requireApiMember(
  request: Request,
  messages: Omit<ApiPermissionMessages, "missingPermission"> = {},
): Promise<ApiPermissionResult> {
  return memberLadder(request, null, messages);
}
