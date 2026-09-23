import { ENTITLEMENTS, type EntitlementWindow, type LimitKey } from "./catalog";

/**
 * Spec 0090 §8 — LA VENTANA de un tope de FLUJO, como funcion pura.
 *
 * Vive aparte de `index.ts` (que ya evalua plan + suscripcion) porque no depende de la
 * suscripcion en absoluto: una ventana es aritmetica de fechas, y sus casos borde
 * —fin de mes, cambio de año— se prueban sin montar un contexto de entitlements.
 *
 * **Limite declarado: la ventana es UTC**, no la zona del negocio. `core.business.timezone`
 * existe, pero el cupo se cuenta con un `created_at >= <inicio>` sobre `catalog_import`, y
 * mezclar zonas ahi haria que dos negocios con el mismo cupo vieran cortes distintos sin que
 * el catalogo pueda expresarlo. Si algun dia el corte tiene que ser local, es una fila mas en
 * el catalogo (`windowTimezone`), no un cambio de forma.
 */

/** La ventana declarada para ese tope, o `null` si es un tope de stock (`locations.max`). */
export function windowOf(key: LimitKey): EntitlementWindow | null {
  // El `satisfies` del catalogo mantiene `window` opcional, asi que las entradas que no la
  // declaran no tienen la propiedad ni en el tipo: el acceso va por un indice ancho.
  const def = ENTITLEMENTS[key] as { window?: EntitlementWindow };
  return def.window ?? null;
}

/** El instante en que arranca la ventana que contiene a `now`. Inclusivo. */
export function windowStart(window: EntitlementWindow, now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (window === "day") return start;
  if (window === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  // `week`: arranca el LUNES. `getUTCDay()` devuelve 0 para domingo, que es el dia 7 de la
  // semana ISO — sin este ajuste un domingo abriria una ventana nueva un dia antes.
  const isoDay = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (isoDay - 1));
  return start;
}

/** El instante en que arranca la ventana SIGUIENTE. Exclusivo: es cuando el cupo se repone. */
export function windowEnd(window: EntitlementWindow, now: Date): Date {
  const start = windowStart(window, now);
  const next = new Date(start);
  if (window === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (window === "week") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/**
 * Segundos hasta que el cupo se repone, para el `Retry-After` y el `retryAfterSeconds` del
 * cuerpo (§8). **Nunca menor que 1**: un `Retry-After: 0` le dice al cliente que reintente
 * ya mismo, que es lo contrario de lo que un 429 quiere decir.
 */
export function retryAfterSeconds(
  window: EntitlementWindow,
  now: Date,
): number {
  const ms = windowEnd(window, now).getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / 1000));
}
