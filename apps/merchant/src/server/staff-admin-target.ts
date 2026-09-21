import { StaffError } from "./staff-error";

/**
 * R5 — **UN ADMINISTRADOR NO TOCA A OTRO ADMINISTRADOR.** Decision textual del owner del
 * 2026-09-21: *«solo owner puede reestablecer el pin de otro administrador de staff y darlo de
 * baja»*.
 *
 * Vive en este archivo, y no en `staff-permissions.ts`, por una razon de ciclos: `StaffError`
 * nace aca y `staff-permissions.ts` ya importa de aca, asi que el guard en el sentido contrario
 * cerraria el ciclo. Sus tres consumidores —el estado (abajo), el PIN
 * (`api/staff/[userId]/pin/regenerate`) y el listado de reglas de `staff-permissions.ts`— lo
 * toman de un solo lugar.
 *
 * **Mira la fila ACTUAL del target, no el cuerpo del request**, y por eso **corre DESPUES** de
 * resolverlo: un `userId` inexistente o de otro negocio tiene que seguir contestando `404`. Si
 * corriera antes, el `403` confirmaria que ese id existe.
 *
 * **Es un `code` propio y no `target_is_owner`:** el owner es intocable SIEMPRE (R4, hasta para
 * el propio owner), y un administrador es intocable **solo para otro no-owner**. Dos reglas con
 * el mismo `code` serian dos causas con un solo mensaje, y el `code` en este repo ES el
 * contrato.
 *
 * No es escalada de PERMISOS —quien la viola ya tiene `staff`—, es interferencia entre pares:
 * con el PIN en claro se toma la cuenta del otro, y con la baja se lo saca del medio.
 */
export function assertTargetNotAdministrator(
  callerRole: string,
  targetPermissions: readonly string[] | null | undefined,
) {
  if (callerRole === "owner") return;
  if ((targetPermissions ?? []).includes("staff")) {
    throw new StaffError(
      403,
      "Solo el owner puede regenerar el PIN o dar de baja a un Administrador.",
      "target_is_administrator",
    );
  }
}
