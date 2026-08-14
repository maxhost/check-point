import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { enrollAttempts } from "../schema";
import { ConsumerError } from "./core";

/** Max enroll attempts allowed per phone within the window before the next one is blocked. */
export const RATE_LIMIT_MAX = 3;
/** Trailing window for the per-phone rate limit, in milliseconds (1 hour). */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Per-phone (not per-IP) rate limit: counts `enroll_attempt` rows for this phone
 * in the trailing window; if there are already ≥ RATE_LIMIT_MAX, throws 429 without
 * touching anything else. Otherwise records this attempt and returns. Keyed by phone
 * on purpose — many legitimate customers enroll from the same shop WiFi (spec 0028).
 */
export async function enforceEnrollRateLimit(
  phoneE164: string,
  now = new Date(),
): Promise<void> {
  const db = getDb();
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollAttempts)
    .where(
      and(
        eq(enrollAttempts.phoneE164, phoneE164),
        gte(enrollAttempts.createdAt, since),
      ),
    );
  if (Number(row?.count ?? 0) >= RATE_LIMIT_MAX) {
    throw new ConsumerError(
      429,
      "rate_limited",
      "Demasiados intentos con este teléfono. Esperá un momento y volvé a intentar.",
    );
  }
  await db.insert(enrollAttempts).values({ phoneE164 });
}
