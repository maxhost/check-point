/**
 * MEASURED: `db.execute(sql…)` returns the driver's RAW values, while the query builder
 * maps them through each column's decoder. A `timestamptz` therefore arrives as a
 * **string** from a raw statement and as a `Date` from a builder select — and a string
 * where a `Date` is declared passes `typecheck` (the generic of `execute<T>` is an
 * assertion, not a check) and dies later with `candidate.enrolledAt.getTime is not a
 * function`, or worse, compares as a string.
 *
 * The marketing loaders use raw SQL on purpose (correlated subqueries need explicit
 * aliases — see `audience-store.ts`), so every date they read crosses this function.
 * Booleans and `integer`s do NOT need it: the driver already returns `true`/`false` and
 * numbers (verified with a probe against the branch).
 */
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  return new Date(String(value));
}

/** The same, for a column the schema declares `not null`. */
export function requireDate(value: unknown): Date {
  const parsed = toDate(value);
  if (!parsed) throw new Error("Se esperaba una fecha y llego null.");
  return parsed;
}
