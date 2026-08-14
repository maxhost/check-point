import { toString as qrToStringCb } from "qrcode";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, walletPasses } from "../schema";
import {
  type ConsumerAccountRow,
  generateOpaqueToken,
  hashToken,
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
  authTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Client-facing shape of a wallet pass. Built by explicit allow-list so it can
 * NEVER serialize the raw `authTokenHash` (nor any future secret column). The
 * `serialNumber` is a public identifier carried in the pass itself, not a secret.
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

/**
 * Renders the consumer's `qrToken` as a standalone, scannable QR as an SVG string
 * (no canvas — pure string output, safe in the Node runtime). The SVG is inlined
 * in the consumer surface; the token itself is never exposed as text.
 */
export function renderQrSvg(qrToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    qrToStringCb(
      qrToken,
      { type: "svg", margin: 1, errorCorrectionLevel: "M" },
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
 * Create-or-reuse the single `wallet_pass` row for (consumer, provider). The
 * `serialNumber` is generated once and stays stable across re-emissions (the
 * unique on (consumer_id, provider) backs idempotency; a race also lands on the
 * existing row via 23505 → re-select). Never duplicates.
 */
export async function ensureWalletPass(
  consumerId: string,
  provider: WalletProviderId,
): Promise<WalletPassRow> {
  const existing = await selectPass(consumerId, provider);
  if (existing) return existing;
  try {
    const [row] = await getDb()
      .insert(walletPasses)
      .values({
        consumerId,
        provider,
        serialNumber: generateOpaqueToken(),
      })
      .returning();
    return row;
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      const raced = await selectPass(consumerId, provider);
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * Persists the sha256 of the Apple web-service `authenticationToken` (compared in
 * spec 0033). The raw token lives only inside the pass; only its hash is stored.
 */
export async function setAuthTokenHash(
  passId: string,
  rawAuthToken: string,
): Promise<void> {
  await getDb()
    .update(walletPasses)
    .set({ authTokenHash: hashToken(rawAuthToken), updatedAt: new Date() })
    .where(eq(walletPasses.id, passId));
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
