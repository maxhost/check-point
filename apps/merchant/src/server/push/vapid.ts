import { type KeyObject, createPrivateKey, createSign } from "node:crypto";

/**
 * VAPID application-server keys (RFC 8292). The wire format is the same one every push
 * client speaks: `publicKey` is the base64url of the 65-byte uncompressed P-256 point
 * (`0x04 || X || Y`) — it doubles as the browser `applicationServerKey`; `privateKey`
 * is the base64url of the 32-byte private scalar `d`. Kept as our own secret in env
 * (ADR 0024), so we own the format.
 */
export type VapidKeys = {
  /** base64url of the 65-byte uncompressed public point. */
  publicKey: string;
  /** base64url of the 32-byte private scalar. */
  privateKey: string;
  /** `mailto:` (or `https:`) contact required by RFC 8292 §2.1. */
  subject: string;
};

/** A private KeyObject reconstructed from the raw VAPID key pair, ready to sign. */
export type VapidSigningKey = {
  privateKey: KeyObject;
  publicKey: string;
  subject: string;
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Rebuilds a signing `KeyObject` from the raw base64url VAPID pair by assembling the
 * P-256 JWK (`x`,`y` sliced from the uncompressed public point, `d` the private scalar).
 * `node:crypto` has no "import raw EC scalar" API, so the JWK route is the native way in.
 */
export function importVapidKey(keys: VapidKeys): VapidSigningKey {
  const pub = Buffer.from(keys.publicKey, "base64url");
  if (pub.length !== 65 || pub[0] !== 0x04)
    throw new Error(
      "VAPID public key must be a 65-byte uncompressed P-256 point",
    );
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: pub.subarray(1, 33).toString("base64url"),
    y: pub.subarray(33, 65).toString("base64url"),
    d: Buffer.from(keys.privateKey, "base64url").toString("base64url"),
  };
  const privateKey = createPrivateKey({ key: jwk, format: "jwk" });
  return { privateKey, publicKey: keys.publicKey, subject: keys.subject };
}

/**
 * Builds the VAPID **JWT (ES256)** for one push origin (RFC 8292 §2): header
 * `{typ:'JWT', alg:'ES256'}`, claims `{aud: <origin>, exp, sub}`. `aud` is the ORIGIN
 * of the push endpoint (scheme + host, no path); `exp` is capped at 24h out. Signed with
 * the VAPID private key via `node:crypto`, emitting a JOSE raw R‖S (`ieee-p1363`)
 * signature — same pattern as the APNs JWT of spec 0033 — so push services accept it.
 */
export function buildVapidJwt(
  key: VapidSigningKey,
  audience: string,
  now = new Date(),
): string {
  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud: audience,
    exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
    sub: key.subject,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const signature = createSign("SHA256")
    .update(signingInput)
    .sign({ key: key.privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

/** The origin (scheme + host) of a push endpoint — the VAPID JWT `aud`. */
export function audienceOf(endpoint: string): string {
  return new URL(endpoint).origin;
}

/** The `Authorization: vapid t=<jwt>, k=<public key>` header value (RFC 8292 §3.2). */
export function vapidAuthHeader(jwt: string, publicKey: string): string {
  return `vapid t=${jwt}, k=${publicKey}`;
}

type Env = Record<string, string | undefined>;

/**
 * Normalizes the VAPID `sub` claim to a URI. RFC 8292 §2.1 requires `sub` to be a
 * `mailto:` or `https:` URI; Apple's push service **rejects a bare email with 403**
 * (verified in prod QA — `WEB_PUSH_VAPID_SUBJECT=hola@…` silently 403'd every Web Push
 * while wallet push kept working). A plain `foo@bar` (no scheme) is coerced to
 * `mailto:foo@bar` so a misconfigured env var can never disable the channel. An already
 * schemed value (`mailto:`/`https:`/`http:`) passes through untouched.
 */
export function normalizeVapidSubject(subject: string): string {
  const trimmed = subject.trim();
  if (/^(mailto:|https?:)/i.test(trimmed)) return trimmed;
  return `mailto:${trimmed}`;
}

/**
 * Reads the VAPID key pair from the environment, or null when unconfigured — the caller
 * then treats Web Push as a disabled provider (no prompt, no send), analogous to a 503
 * from an unconfigured wallet provider (ADR 0024).
 */
export function vapidFromEnv(env: Env = process.env): VapidKeys | null {
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const subject = normalizeVapidSubject(
    env.WEB_PUSH_VAPID_SUBJECT ?? "mailto:soporte@mipasaporte.app",
  );
  return { publicKey, privateKey, subject };
}
