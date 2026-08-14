import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, consumerSessions } from "../schema";
import {
  type ConsumerAccountRow,
  SESSION_TTL_DAYS,
  generateOpaqueToken,
  hashToken,
} from "./core";

/**
 * Issues a session for a consumer: returns the raw token (goes to the HttpOnly
 * cookie) and persists only its sha256 hash with a 30-day expiry.
 */
export async function issueSession(
  consumerId: string,
  now = new Date(),
): Promise<string> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await getDb()
    .insert(consumerSessions)
    .values({
      consumerId,
      tokenHash: hashToken(token),
      expiresAt,
    });
  return token;
}

/**
 * Resolves a raw cookie token to its account, or null when the token is absent,
 * unknown, revoked, or expired. Hashes the cookie and matches the stored hash.
 */
export async function resolveSession(
  rawToken: string | undefined,
  now = new Date(),
): Promise<ConsumerAccountRow | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const [row] = await getDb()
    .select({
      id: consumerAccounts.id,
      phoneE164: consumerAccounts.phoneE164,
      phoneVerifiedAt: consumerAccounts.phoneVerifiedAt,
      firstName: consumerAccounts.firstName,
      lastName: consumerAccounts.lastName,
      countryIso: consumerAccounts.countryIso,
      qrToken: consumerAccounts.qrToken,
      createdAt: consumerAccounts.createdAt,
      updatedAt: consumerAccounts.updatedAt,
    })
    .from(consumerSessions)
    .innerJoin(
      consumerAccounts,
      eq(consumerAccounts.id, consumerSessions.consumerId),
    )
    .where(
      and(
        eq(consumerSessions.tokenHash, tokenHash),
        isNull(consumerSessions.revokedAt),
        gt(consumerSessions.expiresAt, now),
      ),
    )
    .limit(1);
  return row ?? null;
}
