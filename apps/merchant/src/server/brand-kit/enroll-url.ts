// Brand kit (spec 0041): builds the public enrollment URL that the poster QR encodes.
// The URL scheme is fixed by ADR 0042 — `/enroll/<programId>` for a global/1-local
// poster, plus a single optional `?loc=<locationId>` query param for a per-local
// poster (pure attribution; it never changes which program the consumer enrolls in).

/** Relative enroll path: `/enroll/<programId>` (+ `?loc=` when a local is given). */
export function enrollPath(
  programId: string,
  locationId?: string | null,
): string {
  const path = `/enroll/${encodeURIComponent(programId)}`;
  return locationId ? `${path}?loc=${encodeURIComponent(locationId)}` : path;
}

/**
 * Absolute enroll URL for the poster QR. The `origin` (e.g. `https://app.example.com`)
 * is derived from the incoming request by the server component — there is no env-based
 * URL helper in this repo (same pattern as the wallet routes). A trailing slash on the
 * origin is tolerated.
 */
export function enrollUrl(
  origin: string,
  programId: string,
  locationId?: string | null,
): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${enrollPath(programId, locationId)}`;
}
