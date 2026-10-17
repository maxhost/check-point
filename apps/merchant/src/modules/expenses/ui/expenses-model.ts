import { formatMinor } from "@mi-pasaporte/domain/financial/rational";
import type {
  Expense,
  ExpenseCategory,
  ExpenseConcept,
  ExpenseContext,
  ExpenseDraftLine,
  ExpenseLine,
} from "../types";

export type EditableExpense = {
  key: string;
  paidOn: string;
  amount: string;
  category: ExpenseCategory | "";
  conceptId: string | null;
  conceptName: string;
  name: string;
  isFixed: boolean;
  location: string;
  sourceText?: string;
};

export const errorMessage = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "No pudimos completar la acción. Intenta otra vez.";

export function localDay(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith("0000")) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
  );
}

export const displayDay = (day: string) => day.split("-").reverse().join("/");

/** No rounding or floating-point conversion: the input must fit the currency. */
export function amountMinor(value: string, minorUnit: 0 | 2): string {
  const normalized = value.trim().replace(",", ".");
  const pattern = minorUnit === 0 ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(normalized))
    throw new Error(
      minorUnit === 0
        ? "Escribe un monto entero, sin decimales."
        : "Escribe un monto con hasta 2 decimales.",
    );
  const [whole, fraction = ""] = normalized.split(".");
  const minor =
    BigInt(whole) * (minorUnit === 0 ? 1n : 100n) +
    BigInt(fraction.padEnd(minorUnit, "0") || "0");
  if (minor <= 0n || minor.toString().length > 18)
    throw new Error(
      "El monto debe ser mayor que 0 y tener hasta 18 dígitos en unidades menores.",
    );
  return minor.toString();
}

export function moneyText(minor: string | null, minorUnit: 0 | 2) {
  return minor === null ? "" : formatMinor(BigInt(minor), minorUnit);
}

export function blankExpense(
  context: ExpenseContext,
  location: string,
): EditableExpense {
  return {
    key: crypto.randomUUID(),
    paidOn: localDay(context.timeZone),
    amount: "",
    category: "",
    conceptId: null,
    conceptName: "",
    name: "",
    isFixed: false,
    location,
  };
}

export function fromDraft(
  line: ExpenseDraftLine,
  context: ExpenseContext,
  explicitLocation: string,
): EditableExpense {
  return {
    key: crypto.randomUUID(),
    paidOn: line.paidOn ?? "",
    amount: moneyText(line.amountMinor, context.minorUnit),
    category: line.category ?? "",
    conceptId: line.conceptId,
    conceptName: line.conceptName ?? "",
    name: line.name ?? "",
    isFixed: line.isFixed ?? false,
    // null from an unresolved draft is never an implicit global selection.
    location:
      line.locationId ?? (explicitLocation === "business" ? "business" : ""),
    sourceText: line.sourceText,
  };
}

export function fromExpense(expense: Expense): EditableExpense {
  return {
    ...expense,
    key: expense.id,
    amount: moneyText(expense.amountMinor, expense.minorUnit),
    location: expense.locationId ?? "business",
  };
}

export function confirmedLine(
  line: EditableExpense,
  context: ExpenseContext,
  concepts: ExpenseConcept[],
): ExpenseLine {
  if (!validDay(line.paidOn))
    throw new Error("Revisa la fecha del pago (AAAA-MM-DD).");
  const category = context.categories.find(
    (entry) => entry.id === line.category,
  )?.id;
  if (!category) throw new Error("Elige una categoría para cada pago.");
  const concept = concepts.find((entry) => entry.id === line.conceptId);
  if (line.conceptId && (!concept || concept.category !== category))
    throw new Error("Revisa el concepto y su categoría.");
  const conceptName = (concept?.name ?? line.conceptName).trim();
  const name = line.name.trim();
  if (!conceptName || conceptName.length > 120 || !name || name.length > 120)
    throw new Error(
      "Completa el concepto y el nombre del pago (hasta 120 caracteres).",
    );
  if (
    line.location !== "business" &&
    !context.locations.some((entry) => entry.id === line.location)
  )
    throw new Error("Elige un local o Todo el negocio para cada pago.");
  return {
    paidOn: line.paidOn,
    amountMinor: amountMinor(line.amount, context.minorUnit),
    category,
    conceptId: concept?.id ?? null,
    conceptName,
    name,
    isFixed: line.isFixed,
    locationId: line.location === "business" ? null : line.location,
  };
}

/** Keep an operation UUID for an identical retry, replace it after a semantic edit. */
export function operationFor(
  previous: { signature: string; id: string } | null,
  body: unknown,
) {
  const signature = JSON.stringify(body);
  return previous?.signature === signature
    ? previous
    : { signature, id: crypto.randomUUID() };
}
