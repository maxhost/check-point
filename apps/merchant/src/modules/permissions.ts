import {
  PERMISSIONS,
  normalizePermissions,
  permissionsForRole,
} from "@mi-pasaporte/db/permissions-catalog";
import type { ModuleManifest } from "./contract";
import { MODULES } from "./registry";

/**
 * Spec 0216 / ADR 0139 §5 — EL CATALOGO VALIDO DE PERMISOS: los del core
 * (`@mi-pasaporte/db/permissions-catalog`) + los que declara cada manifiesto, en ese orden. La
 * base solo valida la FORMA (`PERMISSION_SHAPE`, migracion 0078); la PERTENENCIA se decide aca, y
 * `packages/db` no puede hacerlo porque no lee el registro de `apps/`.
 *
 * Puro (solo hojas puras): lo importan `session-view.ts`, que no arrastra runtime a proposito, el
 * guard de paginas y el writer de permisos del personal.
 */

export function modulePermissionIds(): string[] {
  return MODULES.flatMap((m) => m.permissions.map((p) => p.id));
}

/** Core + modulos. Es el orden en que salen normalizados y el que ve la UI. */
export function validPermissions(): string[] {
  return [...PERMISSIONS, ...modulePermissionIds()];
}

export function isValidPermission(value: unknown): value is string {
  return typeof value === "string" && validPermissions().includes(value);
}

/** Deduplica, descarta lo que no esta en el catalogo valido y ordena como el catalogo. */
export function normalizeValidPermissions(values: readonly string[]): string[] {
  return normalizePermissions(values, validPermissions());
}

/** Lo que la API y las pantallas reciben como `permissions` de una membresia: el owner, TODO el
 * catalogo valido (tambien los de modulo, aunque su fila este en `'{}'`); el resto, su lista
 * normalizada contra el catalogo valido. */
export function memberPermissions(
  role: string,
  stored: readonly string[] | null | undefined,
): string[] {
  return permissionsForRole(role, stored, validPermissions());
}

/** El modulo que declara `permission`, o `null` si es del core o no existe. */
export function modulePermissionOwner(
  permission: string,
): ModuleManifest | null {
  return (
    MODULES.find((m) => m.permissions.some((p) => p.id === permission)) ?? null
  );
}
