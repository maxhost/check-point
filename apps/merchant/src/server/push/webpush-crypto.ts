import { createCipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";

/**
 * RFC 8291 "Message Encryption for Web Push" over the RFC 8188 `aes128gcm` content
 * coding, implemented with `node:crypto` primitives only (ADR 0039 — no `web-push`
 * dependency). Verified byte-for-byte against the RFC 8291 Appendix A test vector (the
 * external oracle CLAUDE.md requires for DIY crypto) in `push.test.ts`.
 *
 * The ephemeral application-server (AS) key pair and the 16-byte salt are generated
 * per message; both are injectable so the vector test can pin them to the RFC values
 * and assert a deterministic output.
 */

/** The client's subscription key material (RFC 8291 §2): its public key + auth secret. */
export type SubscriptionKeys = {
  /** base64url of the 65-byte uncompressed client public key (`p256dh`). */
  p256dhKey: string;
  /** base64url of the 16-byte client auth secret (`auth`). */
  authKey: string;
};

/** Test seam: pin the ephemeral AS private key + salt to reproduce a known vector. */
export type EncryptSeed = {
  /** base64url of the 32-byte AS private scalar. */
  asPrivateKey: string;
  /** base64url of the 16-byte salt. */
  salt: string;
};

/** Default record size (RFC 8188 `rs`); a single record easily fits our short notices. */
const RECORD_SIZE = 4096;

function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(hkdfSync("sha256", ikm, salt, info, length));
}

/**
 * Encrypts `plaintext` for one subscription, returning the full `aes128gcm` record:
 * `salt(16) || rs(4) || idlen(1) || AS_public(65) || ciphertext+tag`. A single record
 * with the `0x02` last-record delimiter (RFC 8188 §2.1). Without `seed` the AS key pair
 * and salt are random (production); with `seed` they are fixed (the Appendix A test).
 */
export function encryptWebPushPayload(
  plaintext: Buffer,
  keys: SubscriptionKeys,
  seed?: EncryptSeed,
): Buffer {
  const uaPublic = Buffer.from(keys.p256dhKey, "base64url");
  const authSecret = Buffer.from(keys.authKey, "base64url");
  const salt = seed ? Buffer.from(seed.salt, "base64url") : randomBytes(16);

  const as = createECDH("prime256v1");
  if (seed) as.setPrivateKey(Buffer.from(seed.asPrivateKey, "base64url"));
  else as.generateKeys();
  const asPublic = as.getPublicKey(); // 65-byte uncompressed point
  const sharedSecret = as.computeSecret(uaPublic);

  // IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info"\0 || ua_public || as_public).
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    uaPublic,
    asPublic,
  ]);
  const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);

  // CEK and NONCE from the RFC 8188 content-coding derivation (salt = record salt).
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);

  const record = Buffer.concat([plaintext, Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(record),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(RECORD_SIZE, 0);
  const header = Buffer.concat([
    salt,
    rs,
    Buffer.from([asPublic.length]),
    asPublic,
  ]);
  return Buffer.concat([header, ciphertext]);
}
