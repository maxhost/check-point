import { timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, walletPasses, walletPushDevices } from "../schema";
import { hashToken } from "../consumer/core";

/** neon-http returns `{ rows }`; normalize to an array of records. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
}

export type AuthedPass = {
  id: string;
  consumerId: string;
  serialNumber: string;
};

export type PassAuthResult =
  | { status: "ok"; pass: AuthedPass }
  | { status: "unauthorized" }
  | { status: "not_found" };

/** Extracts the raw token from an `Authorization: ApplePass <token>` header. */
export function parseApplePassToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^ApplePass\s+(.+)$/.exec(header.trim());
  return match ? match[1].trim() : null;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Authorizes a PassKit request for `serialNumber` with its `Authorization: ApplePass`
 * token: fetches the Apple pass, compares `sha256(token)` in **constant time** against
 * the stored `auth_token_hash`. `401` on a missing/mismatched token (incl. one pass's
 * token used on another's serial), `404` when the serial is unknown.
 */
export async function authorizePass(
  serialNumber: string,
  authHeader: string | null,
): Promise<PassAuthResult> {
  const token = parseApplePassToken(authHeader);
  if (!token) return { status: "unauthorized" };
  const [pass] = await getDb()
    .select({
      id: walletPasses.id,
      consumerId: walletPasses.consumerId,
      serialNumber: walletPasses.serialNumber,
      authTokenHash: walletPasses.authTokenHash,
    })
    .from(walletPasses)
    .where(
      and(
        eq(walletPasses.serialNumber, serialNumber),
        eq(walletPasses.provider, "apple"),
      ),
    )
    .limit(1);
  if (!pass) return { status: "not_found" };
  if (!pass.authTokenHash) return { status: "unauthorized" };
  if (!constantTimeEqualHex(hashToken(token), pass.authTokenHash))
    return { status: "unauthorized" };
  return {
    status: "ok",
    pass: {
      id: pass.id,
      consumerId: pass.consumerId,
      serialNumber: pass.serialNumber,
    },
  };
}

/** Idempotent upsert of a device registration. Returns whether a NEW row was created
 * (`201`) versus an existing one refreshed (`200`), via the `xmax = 0` insert probe. */
export async function registerDevice(opts: {
  passId: string;
  deviceLibraryId: string;
  pushToken: string;
}): Promise<{ created: boolean }> {
  const res = await getDb().execute(sql`
    INSERT INTO consumer.wallet_push_device
      (wallet_pass_id, device_library_id, push_token)
    VALUES (${opts.passId}, ${opts.deviceLibraryId}, ${opts.pushToken})
    ON CONFLICT (device_library_id, wallet_pass_id)
    DO UPDATE SET push_token = EXCLUDED.push_token, updated_at = now()
    RETURNING (xmax = 0) AS inserted`);
  const [row] = rowsOf(res);
  return { created: Boolean(row?.inserted) };
}

/** Idempotent delete of a device registration (always `200`, even if absent). */
export async function unregisterDevice(opts: {
  passId: string;
  deviceLibraryId: string;
}): Promise<void> {
  await getDb()
    .delete(walletPushDevices)
    .where(
      and(
        eq(walletPushDevices.walletPassId, opts.passId),
        eq(walletPushDevices.deviceLibraryId, opts.deviceLibraryId),
      ),
    );
}

/** The serials a device holds that changed since `tag` (epoch-ms string), plus the
 * new `lastUpdated` tag. Returns null when nothing changed (route answers `204`). */
export async function listUpdatedSerials(opts: {
  deviceLibraryId: string;
  passesUpdatedSince?: string | null;
}): Promise<{ lastUpdated: string; serialNumbers: string[] } | null> {
  const since = opts.passesUpdatedSince
    ? Number(opts.passesUpdatedSince)
    : null;
  const rows = await getDb()
    .select({
      serialNumber: walletPasses.serialNumber,
      messageUpdatedAt: consumerAccounts.messageUpdatedAt,
    })
    .from(walletPushDevices)
    .innerJoin(
      walletPasses,
      eq(walletPushDevices.walletPassId, walletPasses.id),
    )
    .innerJoin(
      consumerAccounts,
      eq(walletPasses.consumerId, consumerAccounts.id),
    )
    .where(eq(walletPushDevices.deviceLibraryId, opts.deviceLibraryId));

  let max = 0;
  const serials: string[] = [];
  for (const r of rows) {
    if (!r.messageUpdatedAt) continue;
    const t = r.messageUpdatedAt.getTime();
    if (since !== null && !(t > since)) continue;
    serials.push(r.serialNumber);
    if (t > max) max = t;
  }
  if (serials.length === 0) return null;
  return { lastUpdated: String(max), serialNumbers: serials };
}

export type PassServeData = {
  consumerId: string;
  serialNumber: string;
  qrToken: string;
  firstName: string;
  lastName: string;
  webViewToken: string;
  latestMessage: string | null;
  messageUpdatedAt: Date | null;
};

/** Loads everything needed to (re)build a consumer's Apple pass for the serve route. */
export async function passServeData(
  serialNumber: string,
): Promise<PassServeData | null> {
  const [row] = await getDb()
    .select({
      consumerId: consumerAccounts.id,
      serialNumber: walletPasses.serialNumber,
      qrToken: consumerAccounts.qrToken,
      firstName: consumerAccounts.firstName,
      lastName: consumerAccounts.lastName,
      webViewToken: consumerAccounts.webViewToken,
      latestMessage: consumerAccounts.latestMessage,
      messageUpdatedAt: consumerAccounts.messageUpdatedAt,
    })
    .from(walletPasses)
    .innerJoin(
      consumerAccounts,
      eq(walletPasses.consumerId, consumerAccounts.id),
    )
    .where(
      and(
        eq(walletPasses.serialNumber, serialNumber),
        eq(walletPasses.provider, "apple"),
      ),
    )
    .limit(1);
  return row ?? null;
}
