import { CounterError, isUuid } from "@mi-pasaporte/domain/server/counter/core";

/**
 * Spec 0169 — los errores propios del POS. Es un `CounterError` (mismo `{ error, code }` que el
 * mostrador, misma clasificacion en la ruta) con un `extra` opcional que viaja en el cuerpo:
 * `openCount` de `pos_has_open_orders` y la `order` actual de `version_conflict`.
 */
export class PosError extends CounterError {
  constructor(
    status: number,
    code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(status, code, message);
  }
}

/** Una orden que no existe O que es de otro negocio: siempre 404, nunca 403 (no se confirma
 * que el id exista). */
export function unknownPosOrder(): CounterError {
  return new CounterError(404, "unknown_pos_order", "Esa orden no existe.");
}

export function posOrderNotOpen(): CounterError {
  return new CounterError(
    409,
    "pos_order_not_open",
    "La orden ya no está abierta.",
  );
}

export const VERSION_CONFLICT = "version_conflict";

export function versionConflict(): CounterError {
  return new CounterError(
    409,
    VERSION_CONFLICT,
    "Otra persona modificó esta orden. Revisa los cambios y vuelve a guardar.",
  );
}

export function posDisabled(): CounterError {
  return new CounterError(
    403,
    "pos_disabled",
    "El POS no está activado en este comercio.",
  );
}

/** El `:id` de la ruta. Un id mal formado es una orden que no existe (404), no un 422: desde
 * afuera las dos cosas son «esa orden no esta». */
export function posOrderId(value: unknown): string {
  if (!isUuid(value)) throw unknownPosOrder();
  return (value as string).trim();
}
