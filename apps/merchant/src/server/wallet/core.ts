import { toString as qrToStringCb } from "qrcode";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, walletPasses } from "../schema";
import {
  type ConsumerAccountRow,
  generateOpaqueToken,
  pgErrorCode,
} from "../consumer/core";

/** Provider ids for a wallet pass (one pass per provider per consumer). */
export type WalletProviderId = "apple" | "google";

/** Branding of the identity pass — "Mi Pasaporte", not a per-business brand (ADR 0033). */
export const WALLET_BRAND = {
  organizationName: "Mi Pasaporte",
  description: "Mi Pasaporte",
  /** Deep-teal foreground/background/label used by both Apple and Google passes. */
  backgroundColor: "rgb(15, 42, 58)",
  foregroundColor: "rgb(255, 255, 255)",
  labelColor: "rgb(160, 190, 205)",
  /** Hex mirror of backgroundColor for Google (hexBackgroundColor). */
  hexBackgroundColor: "#0f2a3a",
} as const;

export type WalletPassRow = {
  id: string;
  consumerId: string;
  provider: string;
  serialNumber: string;
  /** STABLE Apple web-service token (spec 0033 fix); null only on un-backfilled legacy rows. */
  authToken: string | null;
  /** DEPRECATED legacy per-emission sha256 (authorize fallback only). */
  authTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A pass guaranteed to carry a non-null stable `authToken` (post-`ensureWalletPass`). */
export type EnsuredWalletPass = WalletPassRow & { authToken: string };

/**
 * Client-facing shape of a wallet pass. Built by explicit allow-list so it can
 * NEVER serialize the stable `authToken` nor the legacy `authTokenHash` (nor any
 * future secret column). The `serialNumber` is a public identifier carried in the
 * pass itself, not a secret.
 */
export function walletPassResponse(pass: WalletPassRow) {
  return {
    id: pass.id,
    provider: pass.provider,
    serialNumber: pass.serialNumber,
    createdAt: pass.createdAt,
    updatedAt: pass.updatedAt,
  };
}

export type WalletPushDeviceRow = {
  id: string;
  walletPassId: string;
  deviceLibraryId: string;
  pushToken: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Client-facing shape of a push device. Explicit allow-list so it can NEVER
 * serialize the APNs `pushToken` (a device secret). `deviceLibraryId` is the
 * device's own opaque handle, not a token of ours.
 */
export function walletPushDeviceResponse(row: WalletPushDeviceRow) {
  return {
    id: row.id,
    deviceLibraryId: row.deviceLibraryId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type WalletPushQueueRow = {
  id: string;
  consumerId: string;
  class: string;
  title: string;
  body: string;
  status: string;
  notBefore: Date;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
};

/**
 * Client-facing shape of a queued notice. The queue carries no token columns, but
 * the DTO is still an explicit allow-list (omits `consumerId`) so no consumer
 * identifier or future secret leaks through an observability surface.
 */
export function walletPushQueueResponse(row: WalletPushQueueRow) {
  return {
    id: row.id,
    class: row.class,
    title: row.title,
    body: row.body,
    status: row.status,
    notBefore: row.notBefore,
    attempts: row.attempts,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  };
}

/**
 * Renders a string payload as a standalone, scannable QR as an SVG string
 * (no canvas — pure string output, safe in the Node runtime). The SVG is inlined
 * in the consumer surface; the payload itself is never exposed as text.
 *
 * `errorCorrectionLevel` defaults to `"M"` (the consumer pass QR). The brand-kit
 * enrolment poster passes `"H"` so a logo can be overlaid at the center without
 * breaking the code (higher redundancy tolerates the occlusion).
 */
export function renderQrSvg(
  payload: string,
  errorCorrectionLevel: "M" | "H" = "M",
): Promise<string> {
  return new Promise((resolve, reject) => {
    qrToStringCb(
      payload,
      { type: "svg", margin: 1, errorCorrectionLevel },
      (err, svg) => (err ? reject(err) : resolve(svg)),
    );
  });
}

async function selectPass(
  consumerId: string,
  provider: WalletProviderId,
): Promise<WalletPassRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(walletPasses)
    .where(
      and(
        eq(walletPasses.consumerId, consumerId),
        eq(walletPasses.provider, provider),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Guarantees the row carries a STABLE, non-null `authToken` (spec 0033 fix). New
 * rows already have one from the insert; legacy rows (`authToken` null, only the
 * deprecated `authTokenHash`) are backfilled ONCE. The `coalesce` makes the update
 * race-safe: concurrent backfills serialize on the row lock and all converge on the
 * first committed token, so the value never diverges from the installed pass.
 */
async function ensureAuthToken(row: WalletPassRow): Promise<EnsuredWalletPass> {
  if (row.authToken) return { ...row, authToken: row.authToken };
  const candidate = generateOpaqueToken();
  const [updated] = await getDb()
    .update(walletPasses)
    .set({
      authToken: sql`coalesce(${walletPasses.authToken}, ${candidate})`,
      updatedAt: new Date(),
    })
    .where(eq(walletPasses.id, row.id))
    .returning();
  const authToken = updated?.authToken ?? candidate;
  return { ...(updated ?? row), authToken };
}

/**
 * Create-or-reuse the single `wallet_pass` row for (consumer, provider). The
 * `serialNumber` AND the Apple web-service `authToken` are generated once and stay
 * stable across re-emissions (the unique on (consumer_id, provider) backs
 * idempotency; a race also lands on the existing row via 23505 → re-select). The
 * returned pass always carries a non-null `authToken` (legacy rows are backfilled).
 * Never duplicates.
 */
export async function ensureWalletPass(
  consumerId: string,
  provider: WalletProviderId,
): Promise<EnsuredWalletPass> {
  const existing = await selectPass(consumerId, provider);
  if (existing) return ensureAuthToken(existing);
  try {
    const [row] = await getDb()
      .insert(walletPasses)
      .values({
        consumerId,
        provider,
        serialNumber: generateOpaqueToken(),
        authToken: generateOpaqueToken(),
      })
      .returning();
    return ensureAuthToken(row);
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      const raced = await selectPass(consumerId, provider);
      if (raced) return ensureAuthToken(raced);
    }
    throw error;
  }
}

/**
 * Resolves a raw `web_view_token` to its account (the "Ver mis programas"
 * magic-link), or null when unknown/revoked. Compared in the clear because the
 * token is a bearer path param (ADR 0014); it is never serialized in a DTO.
 */
export async function resolveWebViewToken(
  token: string | undefined,
): Promise<ConsumerAccountRow | null> {
  if (!token) return null;
  const [row] = await getDb()
    .select()
    .from(consumerAccounts)
    .where(eq(consumerAccounts.webViewToken, token))
    .limit(1);
  return row ?? null;
}
