export function localDay(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
}
export function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}
export function addMonths(day: string, months: number): string {
  const date = new Date(`${monthStart(day)}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(Number(day.slice(8)), last));
  return date.toISOString().slice(0, 10);
}
export function monthEnd(day: string): string {
  return addDays(addMonths(monthStart(day), 1), -1);
}
export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
export function formatMoney(
  amountMinor: number,
  currencyCode: string,
  minorUnit: number,
): string {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: minorUnit,
  }).format(amountMinor / 10 ** minorUnit);
}
export function validDay(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    addDays(value, 0) === value
  );
}
