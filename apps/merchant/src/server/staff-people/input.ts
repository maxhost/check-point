import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { StaffError } from "../staff-error";

export function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new StaffError(400, "El cuerpo no es válido.", "invalid_body");
  return value as Record<string, unknown>;
}
export function personName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name)
    throw new StaffError(400, "El nombre es obligatorio.", "name_required");
  if (name.length > 80)
    throw new StaffError(400, "El nombre es muy largo.", "name_too_long");
  return name;
}
export function expectedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new StaffError(
      409,
      "Actualiza los datos de la persona.",
      "revision_conflict",
    );
  return value as number;
}
export function assertRevision(actual: number, expected: unknown) {
  if (actual !== expectedRevision(expected))
    throw new StaffError(
      409,
      "Los datos cambiaron. Actualízalos e intenta de nuevo.",
      "revision_conflict",
    );
}
export function staffMonth(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/.test(value)
  )
    throw new StaffError(422, "Elige un mes válido.", "invalid_month");
  return `${value}-01`;
}
export function monthInZone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    timeZone: timezone,
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-01`;
}
export function locationIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length)
    throw new StaffError(422, "Elige al menos un local.", "locations_required");
  if (value.some((id) => !isUuid(id)))
    throw new StaffError(404, "Ese local no existe.", "location_not_found");
  return [
    ...new Set((value as string[]).map((id) => id.trim().toLowerCase())),
  ].sort();
}
