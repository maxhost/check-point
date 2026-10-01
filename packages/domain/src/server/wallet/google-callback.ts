import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { loyaltyClassId } from "./google-object";

/**
 * GOOGLE WALLET's `save`/`del` CALLBACK (spec 0107 §4 / ADR 0099 §2): the only signal that
 * an Android user INSTALLED the pass (a generated pass is not an installed one,
 * `wallet/core.ts`). Google signs it with `ECv2SigningOnly`, sender `GooglePayPasses`,
 * recipient = our issuer id; verified here with `node:crypto`, no dependency:
 *
 *  1. a ROOT key of `https://pay.google.com/gp/m/issuer/keys` (cached with its
 *     `keyExpiration`) signs the intermediate key: ECDSA P-256 / SHA-256 (DER) over
 *     `len‖"GooglePayPasses"‖len‖"ECv2SigningOnly"‖len‖signedKey`;
 *  2. the intermediate key has not expired (`keyExpiration`, epoch ms);
 *  3. the intermediate signs the message over
 *     `len‖"GooglePayPasses"‖len‖<issuerId>‖len‖"ECv2SigningOnly"‖len‖signedMessage`;
 *  4. the message's own `expTimeMillis`, when present, has not passed.
 * Every `len` is 4 bytes little-endian. A body that is not the envelope is a 400; a
 * signature or an expiry that fails is a 401. The ROOT KEY SOURCE is injectable: the tests
 * sign with keys of their own (the real format is checked in the owner's QA, declared).
 */

export const GOOGLE_ROOT_KEYS_URL = "https://pay.google.com/gp/m/issuer/keys";
const SENDER = "GooglePayPasses";
const PROTOCOL = "ECv2SigningOnly";

export type GoogleRootKey = {
  keyValue: string;
  protocolVersion: string;
  keyExpiration?: string;
};
export type RootKeySource = (now: Date) => Promise<GoogleRootKey[]>;

export type GoogleCallbackMessage = {
  classId: string;
  objectId: string;
  eventType: string;
};

export class GoogleCallbackError extends Error {
  constructor(
    readonly status: 400 | 401,
    message: string,
  ) {
    super(message);
  }
}

const malformed = (why: string) => new GoogleCallbackError(400, why);
const refused = (why: string) => new GoogleCallbackError(401, why);

/** `len‖part` for each part: 4-byte little-endian length, then the UTF-8 bytes. */
export function lengthValue(...parts: string[]): Buffer {
  return Buffer.concat(
    parts.flatMap((part) => {
      const bytes = Buffer.from(part, "utf8");
      const length = Buffer.alloc(4);
      length.writeUInt32LE(bytes.length);
      return [length, bytes];
    }),
  );
}

function publicKey(base64: string): KeyObject | null {
  try {
    return createPublicKey({
      key: Buffer.from(base64, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    return null;
  }
}

function verifies(key: KeyObject, data: Buffer, signature: unknown): boolean {
  if (typeof signature !== "string") return false;
  try {
    return verify(
      "sha256",
      data,
      { key, dsaEncoding: "der" },
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}

const notExpired = (expiration: unknown, now: Date) =>
  expiration === undefined || Number(expiration) > now.getTime();

function parseJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") throw malformed("not a string");
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    // falls through
  }
  throw malformed("not a JSON object");
}

let cached: GoogleRootKey[] = [];

/** Google's root keys, cached in memory until every one of them has expired. */
export const googleRootKeys: RootKeySource = async (now) => {
  const live = cached.filter((key) => notExpired(key.keyExpiration, now));
  if (live.length > 0) return live;
  const response = await fetch(GOOGLE_ROOT_KEYS_URL);
  if (!response.ok) throw new Error(`Google root keys: ${response.status}`);
  const json = (await response.json()) as { keys?: GoogleRootKey[] };
  cached = Array.isArray(json.keys) ? json.keys : [];
  return cached.filter((key) => notExpired(key.keyExpiration, now));
};

/** Verifies the envelope and returns the message, or throws a `GoogleCallbackError`. */
export async function verifyGoogleCallback(
  body: unknown,
  issuerId: string,
  now: Date,
  keys: RootKeySource = googleRootKeys,
): Promise<GoogleCallbackMessage> {
  const envelope = (body ?? {}) as Record<string, unknown>;
  const intermediate = (envelope.intermediateSigningKey ?? {}) as Record<
    string,
    unknown
  >;
  if (
    envelope.protocolVersion !== PROTOCOL ||
    typeof envelope.signedMessage !== "string" ||
    typeof intermediate.signedKey !== "string" ||
    !Array.isArray(intermediate.signatures)
  )
    throw malformed("not an ECv2SigningOnly envelope");
  const signedKey = intermediate.signedKey;
  const roots = (await keys(now))
    .filter((key) => key.protocolVersion === PROTOCOL)
    .map((key) => publicKey(key.keyValue))
    .filter((key): key is KeyObject => key !== null);
  const keyData = lengthValue(SENDER, PROTOCOL, signedKey);
  const trusted = roots.some((root) =>
    (intermediate.signatures as unknown[]).some((signature) =>
      verifies(root, keyData, signature),
    ),
  );
  if (!trusted) throw refused("intermediate key not signed by a root key");
  const inner = parseJson(signedKey);
  if (!notExpired(inner.keyExpiration ?? "0", now))
    throw refused("intermediate key expired");
  const intermediateKey = publicKey(String(inner.keyValue ?? ""));
  if (!intermediateKey) throw refused("intermediate key unreadable");
  const messageData = lengthValue(
    SENDER,
    issuerId,
    PROTOCOL,
    envelope.signedMessage,
  );
  if (!verifies(intermediateKey, messageData, envelope.signature))
    throw refused("message not signed by the intermediate key");
  const message = parseJson(envelope.signedMessage);
  if (!notExpired(message.expTimeMillis, now)) throw refused("message expired");
  const { classId, objectId, eventType } = message;
  if (
    typeof classId !== "string" ||
    typeof objectId !== "string" ||
    typeof eventType !== "string"
  )
    throw malformed("message without classId/objectId/eventType");
  return { classId, objectId, eventType };
}

/**
 * The EFFECT of a verified message. Only a `save` of OUR class touches anything: it stamps
 * `google_saved_at` once (`coalesce`) on the Google pass whose serial is the `objectId`
 * without the `<issuer>.` prefix, and answers its consumer — the caller issues the welcome
 * gift. A `del`, another class or an unknown object is `null`: nothing to do. Idempotent
 * (the `nonce` is not stored: every effect already is).
 */
export async function recordGoogleSave(
  message: GoogleCallbackMessage,
  issuerId: string,
  now: Date,
): Promise<string | null> {
  if (message.classId !== loyaltyClassId(issuerId)) return null;
  if (message.eventType !== "save") return null;
  const prefix = `${issuerId}.`;
  if (!message.objectId.startsWith(prefix)) return null;
  const serial = message.objectId.slice(prefix.length);
  const result = await getDb().execute<{ consumer_id: string }>(sql`
    update consumer.wallet_pass
    set google_saved_at = coalesce(google_saved_at, ${now.toISOString()}::timestamptz)
    where provider = 'google' and serial_number = ${serial}
    returning consumer_id`);
  return result.rows[0]?.consumer_id ?? null;
}
