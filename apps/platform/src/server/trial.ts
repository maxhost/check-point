/**
 * Spec 0190 §D5 — el cambio de la fecha de fin de la prueba que pide el panel.
 * `add_days` suma desde el fin actual si la prueba sigue vigente y desde AHORA si ya vencio
 * (o no hay fecha): extender siempre deja dias de verdad. `set_date` es ese dia a las 23:59:59
 * de Ecuador (UTC-5 todo el año, sin horario de verano).
 */
export type TrialChange =
  | { mode: "add_days"; days: number }
  | { mode: "set_date"; date: string; confirmBlock?: boolean };

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function nextTrialEnd(
  current: Date | null,
  now: Date,
  change: TrialChange,
): Date {
  if (change.mode === "add_days") {
    const from = Math.max(current?.getTime() ?? now.getTime(), now.getTime());
    return new Date(from + change.days * DAY_MS);
  }
  return new Date(`${change.date}T23:59:59-05:00`);
}

/** El cuerpo de `POST /api/businesses/[id]/trial`, validado; `null` = 400 `invalid_body`. */
export function parseTrialChange(body: unknown): TrialChange | null {
  if (typeof body !== "object" || body === null) return null;
  const input = body as Record<string, unknown>;
  if (input.mode === "add_days") {
    const days = input.days;
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 365
    ) {
      return null;
    }
    return { mode: "add_days", days };
  }
  if (input.mode === "set_date") {
    const date = input.date;
    if (typeof date !== "string" || !isCalendarDate(date)) return null;
    const confirmBlock = input.confirmBlock;
    if (confirmBlock !== undefined && typeof confirmBlock !== "boolean") {
      return null;
    }
    return { mode: "set_date", date, confirmBlock: confirmBlock === true };
  }
  return null;
}

/** `AAAA-MM-DD` que existe en el calendario (rechaza `2026-02-30`). */
function isCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}
