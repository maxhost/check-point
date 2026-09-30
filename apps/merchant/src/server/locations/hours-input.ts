/**
 * THE BODY OF `PUT /api/locations/{locationId}/hours` (spec 0113 H1 / ADR 0105 §5). PURE.
 *
 * `{ days: [{ weekday, ranges: [{ opens, closes }] }] }` — the WHOLE week: the 7 ISO days
 * (1 = Monday … 7 = Sunday), each once. `ranges: []` is closed; at most 2 ranges (the
 * «cortado»). `HH:MM` in steps of 30 minutes. `closes <= opens` closes the NEXT day (V1:
 * Saturday 20:00–02:00 is Saturday night). The two ranges of a day must not overlap, with a
 * range that crosses midnight measured as running past 24:00.
 *
 * Errors are keyed like the contract: `fields.days` (missing or repeated days, not a list)
 * and `fields["days.N.ranges.M"]` — N and M are the positions IN THE REQUEST — for a bad
 * format or step, an empty range, an overlap or a third range.
 */

export type HoursRange = { opens: string; closes: string };
export type DayHours = { weekday: number; ranges: HoursRange[] };

export type HoursParse =
  | { ok: true; days: DayHours[] }
  | { ok: false; fields: Record<string, string> };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_RANGES = 2;
const DAY_MINUTES = 1440;

/** Minutes since midnight of an `HH:MM`, or `null` when it is not one. */
export function toMinutes(raw: unknown): number | null {
  const match = typeof raw === "string" ? TIME.exec(raw) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** `[start, end)` in minutes; a range that closes the next day runs past 1440. */
function span(opens: number, closes: number): [number, number] {
  return [opens, closes <= opens ? closes + DAY_MINUTES : closes];
}

function rangeOf(
  raw: unknown,
):
  | { ok: true; range: HoursRange; span: [number, number] }
  | { ok: false; message: string } {
  const item = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const opens = toMinutes(item.opens);
  const closes = toMinutes(item.closes);
  if (opens === null || closes === null)
    return { ok: false, message: "Las horas van como HH:MM (ej. 08:30)." };
  if (opens % 30 !== 0 || closes % 30 !== 0)
    return { ok: false, message: "Las horas van en pasos de 30 minutos." };
  if (opens === closes)
    return {
      ok: false,
      message: "Un rango no puede abrir y cerrar a la misma hora.",
    };
  return {
    ok: true,
    range: { opens: String(item.opens), closes: String(item.closes) },
    span: span(opens, closes),
  };
}

export function parseHours(value: unknown): HoursParse {
  const body =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const days = body.days;
  const fields: Record<string, string> = {};
  if (!Array.isArray(days))
    return { ok: false, fields: { days: "Mandá los 7 días de la semana." } };
  const weekdays = days.map((day: unknown) =>
    day && typeof day === "object"
      ? (day as { weekday?: unknown }).weekday
      : null,
  );
  const valid = weekdays.every(
    (weekday) =>
      typeof weekday === "number" &&
      Number.isInteger(weekday) &&
      weekday >= 1 &&
      weekday <= 7,
  );
  if (!valid || days.length !== 7 || new Set(weekdays).size !== 7)
    return {
      ok: false,
      fields: {
        days: "Mandá los 7 días de la semana (1 a 7), cada uno una vez.",
      },
    };
  const out: DayHours[] = [];
  days.forEach((day: { weekday: number; ranges?: unknown }, n) => {
    const ranges = day.ranges;
    if (!Array.isArray(ranges)) {
      fields[`days.${n}.ranges`] =
        "Los rangos van en una lista ([] = cerrado).";
      return;
    }
    const kept: { range: HoursRange; span: [number, number] }[] = [];
    ranges.forEach((raw: unknown, m) => {
      const key = `days.${n}.ranges.${m}`;
      if (m >= MAX_RANGES) {
        fields[key] = "Un día tiene como máximo 2 rangos.";
        return;
      }
      const parsed = rangeOf(raw);
      if (!parsed.ok) {
        fields[key] = parsed.message;
        return;
      }
      const [start, end] = parsed.span;
      if (kept.some(({ span: [a, b] }) => a < end && start < b)) {
        fields[key] = "Los dos rangos del día se pisan.";
        return;
      }
      kept.push(parsed);
    });
    kept.sort((a, b) => a.span[0] - b.span[0]);
    out.push({ weekday: day.weekday, ranges: kept.map(({ range }) => range) });
  });
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, days: out.sort((a, b) => a.weekday - b.weekday) };
}
