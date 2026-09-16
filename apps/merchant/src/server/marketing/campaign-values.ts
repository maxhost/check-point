/** Same helper as `locations/shared.ts`: a body that is not an object is an empty one,
 * so every field reports its own `validation` error instead of the whole request
 * failing with one opaque message. */
export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
