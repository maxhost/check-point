import { type CloseInput, LoyaltyError } from "./core";
import { isIanaTimezone } from "../timezone";

function datePartsAt(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

/** Converts a browser datetime-local value in a business IANA zone into UTC. */
export function zonedDateTimeToUtc(value: unknown, timezone: string) {
  if (!isIanaTimezone(timezone) || typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const wanted = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const nominalUtc = Date.UTC(
    wanted.year,
    wanted.month - 1,
    wanted.day,
    wanted.hour,
    wanted.minute,
    wanted.second,
  );
  let candidate = nominalUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = datePartsAt(new Date(candidate), timezone);
    candidate +=
      nominalUtc -
      Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
      );
  }
  const result = new Date(candidate);
  const resolved = datePartsAt(result, timezone);
  return Object.entries(wanted).every(
    ([key, expected]) => resolved[key as keyof typeof resolved] === expected,
  )
    ? result
    : null;
}

export function formatBusinessDate(value: Date | null, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

/** Validates a closing window in the business zone; throws 422 on an invalid or past window. */
export function validateClosingWindow(
  input: CloseInput,
  timezone: string,
  now: Date,
) {
  const earningEndsAt = zonedDateTimeToUtc(input.earningEndsAt, timezone);
  const redemptionEndsAt = zonedDateTimeToUtc(input.redemptionEndsAt, timezone);
  if (
    !earningEndsAt ||
    !redemptionEndsAt ||
    earningEndsAt <= now ||
    earningEndsAt >= redemptionEndsAt
  ) {
    throw new LoyaltyError(
      422,
      "Indica una ventana futura válida en la zona horaria del negocio.",
    );
  }
  return { earningEndsAt, redemptionEndsAt };
}
