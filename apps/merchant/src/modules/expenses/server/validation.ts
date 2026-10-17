import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { ModuleError } from "../../errors";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseLine,
} from "../types";
export function invalidExpense(
  message = "Revisa la fecha, el monto, el concepto y el local del gasto.",
): never {
  throw new ModuleError(422, "invalid_expense", message);
}
export function normalizeConceptName(name: string) {
  return name.normalize("NFKC").toLowerCase().trim().replace(/\s+/gu, " ");
}
export function validDay(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "0001-01-01"
  )
    return false;
  const d = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function validAmount(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,17}$/.test(value);
}
export function validCategory(value: unknown): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.some((c) => c.id === value);
}
function label(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 120 ||
    value.includes("\u0000")
  )
    invalidExpense();
  return value.trim();
}
export function parseLocation(value: unknown): string | null {
  if (value === null) return null;
  if (!isUuid(value)) invalidExpense("Elige un local o Todo el negocio.");
  return (value as string).trim().toLowerCase();
}
export function parseLine(raw: unknown): ExpenseLine {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalidExpense();
  const line = raw as Record<string, unknown>;
  if (
    !validDay(line.paidOn) ||
    !validAmount(line.amountMinor) ||
    !validCategory(line.category) ||
    typeof line.isFixed !== "boolean"
  )
    invalidExpense();
  if (line.conceptId !== null && !isUuid(line.conceptId)) invalidExpense();
  const conceptName = label(line.conceptName);
  if (normalizeConceptName(conceptName).length > 120) invalidExpense();
  return {
    paidOn: line.paidOn,
    amountMinor: line.amountMinor,
    category: line.category,
    conceptId:
      line.conceptId === null
        ? null
        : (line.conceptId as string).trim().toLowerCase(),
    conceptName,
    name: label(line.name),
    isFixed: line.isFixed,
    locationId: parseLocation(line.locationId),
  };
}
export function operationId(value: unknown): string {
  if (!isUuid(value))
    throw new ModuleError(400, "invalid_body", "La operación no es válida.");
  return (value as string).trim().toLowerCase();
}
export function expectedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) invalidExpense();
  return value as number;
}
export function currency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) invalidExpense();
  return value;
}
