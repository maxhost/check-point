/** Bump this whenever a shared Apple pass design changes, so installed passes can pull it. */
export const PASS_BRAND_UPDATED_AT = new Date("2026-10-02T03:47:00Z");

/** PassKit must compare both content and design revisions for conditional GETs. */
export function passVersionUpdatedAt(messageUpdatedAt: Date | null): Date {
  return new Date(
    Math.max(messageUpdatedAt?.getTime() ?? 0, PASS_BRAND_UPDATED_AT.getTime()),
  );
}
