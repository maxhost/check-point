import { MODULES } from "./registry";
import { moduleHref } from "./navigation";

/**
 * Spec 0220 / ADR 0141 §2 — LA PAGINA DE INICIO QUE APORTAN LOS MODULOS (`startPage`), pura. El
 * core la usa sin nombrar ningun modulo: la PWA (`/backoffice/start`) y el ingreso del personal
 * (`server/staff-landing.ts`). Se recorre el registro EN SU ORDEN y solo cuentan los modulos
 * ENCENDIDOS.
 */

/** PWA: el primer modulo encendido con `startPage` cuyo permiso tiene el usuario (el owner los
 * tiene todos) → su pagina; si no hay, `null` (el panel). */
export function startPageFor(
  enabled: ReadonlySet<string>,
  viewer: { isOwner: boolean; permissions: readonly string[] },
): string | null {
  const found = MODULES.find(
    (m) =>
      m.startPage !== undefined &&
      enabled.has(m.id) &&
      (viewer.isOwner || viewer.permissions.includes(m.startPage.permission)),
  );
  return found?.startPage ? moduleHref(found.id, found.startPage.path) : null;
}

/** Ingreso del personal (decision del owner, spec 0218): si sus permisos EFECTIVOS son EXACTAMENTE
 * el permiso de la pagina de inicio de un modulo encendido → esa pagina; si no, `null` (el panel). */
export function staffStartPage(
  effective: readonly string[],
  enabled: ReadonlySet<string>,
): string | null {
  if (effective.length !== 1) return null;
  return startPageFor(enabled, { isOwner: false, permissions: effective });
}
