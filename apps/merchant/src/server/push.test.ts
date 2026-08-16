import { createECDH, createPublicKey, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  audienceOf,
  buildVapidJwt,
  importVapidKey,
  normalizeVapidSubject,
  vapidAuthHeader,
  vapidFromEnv,
} from "./push/vapid";
import { encryptWebPushPayload } from "./push/webpush-crypto";
import {
  derivePlatform,
  webPushSubscriptionResponse,
} from "./push/subscriptions";

/** A raw web-push-style VAPID pair: public = 65-byte uncompressed b64url, private = d b64url. */
function vapidPair() {
  const ec = createECDH("prime256v1");
  ec.generateKeys();
  return {
    publicKey: ec.getPublicKey().toString("base64url"),
    privateKey: ec.getPrivateKey().toString("base64url"),
    subject: "mailto:soporte@mipasaporte.app",
  };
}

describe("VAPID JWT (ES256, RFC 8292)", () => {
  it("is ES256/JWT with aud=origin, sub=subject, and a signature that verifies with the public key", () => {
    const pair = vapidPair();
    const key = importVapidKey(pair);
    const now = new Date(1_700_000_000_000);
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
    const jwt = buildVapidJwt(key, audienceOf(endpoint), now);

    const [header, payload, signature] = jwt.split(".");
    expect(header && payload && signature).toBeTruthy();

    const head = JSON.parse(Buffer.from(header, "base64url").toString());
    expect(head.alg).toBe("ES256");
    expect(head.typ).toBe("JWT");

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:soporte@mipasaporte.app");
    // exp is in the future, capped ~12h out (RFC 8292 requires < 24h).
    expect(claims.exp).toBe(Math.floor(now.getTime() / 1000) + 12 * 60 * 60);

    // Verify the raw R‖S (ieee-p1363) signature with the public half of the VAPID key.
    const pub = Buffer.from(pair.publicKey, "base64url");
    const pubKey = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: pub.subarray(1, 33).toString("base64url"),
        y: pub.subarray(33, 65).toString("base64url"),
      },
      format: "jwk",
    });
    const ok = createVerify("SHA256")
      .update(`${header}.${payload}`)
      .verify(
        { key: pubKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature, "base64url"),
      );
    expect(ok).toBe(true);
  });

  it("builds the `vapid t=…, k=…` Authorization header", () => {
    expect(vapidAuthHeader("JWT", "PUBKEY")).toBe("vapid t=JWT, k=PUBKEY");
  });

  it("vapidFromEnv is null without keys and populated with them", () => {
    expect(vapidFromEnv({})).toBeNull();
    const cfg = vapidFromEnv({
      WEB_PUSH_VAPID_PUBLIC_KEY: "pub",
      WEB_PUSH_VAPID_PRIVATE_KEY: "priv",
    });
    expect(cfg).toMatchObject({ publicKey: "pub", privateKey: "priv" });
    expect(cfg?.subject).toMatch(/^mailto:/);
  });

  it("normalizes a bare-email subject to a mailto: URI (Apple 403 guard)", () => {
    // A bare email in WEB_PUSH_VAPID_SUBJECT made Apple's push service 403 every send
    // (prod QA). It must be coerced to a mailto: URI so the channel can't be disabled by
    // a missing scheme.
    expect(normalizeVapidSubject("hola@nocodecompany.co")).toBe(
      "mailto:hola@nocodecompany.co",
    );
    expect(normalizeVapidSubject("  hola@nocodecompany.co  ")).toBe(
      "mailto:hola@nocodecompany.co",
    );
    // Already-schemed values pass through untouched.
    expect(normalizeVapidSubject("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(normalizeVapidSubject("https://mipasaporte.app")).toBe(
      "https://mipasaporte.app",
    );
    // Applied through the env reader.
    expect(
      vapidFromEnv({
        WEB_PUSH_VAPID_PUBLIC_KEY: "pub",
        WEB_PUSH_VAPID_PRIVATE_KEY: "priv",
        WEB_PUSH_VAPID_SUBJECT: "hola@nocodecompany.co",
      })?.subject,
    ).toBe("mailto:hola@nocodecompany.co");
  });
});

// The authoritative test vector from RFC 8291 Appendix A ("Push Message Encryption
// Example"). If `encryptWebPushPayload` does not reproduce this byte-for-byte, the
// implementation is wrong — this is the external oracle CLAUDE.md mandates for DIY crypto.
const RFC8291_A = {
  plaintext: "When I grow up, I want to be a watermelon",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("RFC 8291 aes128gcm payload encryption (Appendix A vector)", () => {
  it("reproduces the published encrypted body byte-for-byte", () => {
    const body = encryptWebPushPayload(
      Buffer.from(RFC8291_A.plaintext, "utf8"),
      { p256dhKey: RFC8291_A.uaPublic, authKey: RFC8291_A.auth },
      { asPrivateKey: RFC8291_A.asPrivate, salt: RFC8291_A.salt },
    );
    expect(body.toString("base64url")).toBe(RFC8291_A.body);
  });
});

describe("web push subscription DTO never leaks secrets", () => {
  it("webPushSubscriptionResponse omits endpoint/p256dh/auth", () => {
    const dto = webPushSubscriptionResponse({
      id: "sub-1",
      consumerId: "SECRET-CONSUMER",
      endpoint: "https://push.example/SECRET-ENDPOINT",
      p256dhKey: "SECRET-P256DH",
      authKey: "SECRET-AUTH",
      userAgent: "UA",
      platform: "android",
      createdAt: new Date("2026-08-15T00:00:00Z"),
      lastSeenAt: new Date("2026-08-15T00:00:00Z"),
    });
    expect(dto).not.toHaveProperty("endpoint");
    expect(dto).not.toHaveProperty("p256dhKey");
    expect(dto).not.toHaveProperty("authKey");
    expect(dto).not.toHaveProperty("consumerId");
    const json = JSON.stringify(dto);
    expect(json).not.toContain("SECRET-ENDPOINT");
    expect(json).not.toContain("SECRET-P256DH");
    expect(json).not.toContain("SECRET-AUTH");
    expect(dto).toMatchObject({ id: "sub-1", platform: "android" });
  });
});

describe("platform derivation", () => {
  it("maps the UA to ios/android/other", () => {
    expect(derivePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 16_4)")).toBe(
      "ios",
    );
    expect(derivePlatform("Mozilla/5.0 (Linux; Android 14; Pixel)")).toBe(
      "android",
    );
    expect(derivePlatform("Mozilla/5.0 (Windows NT 10.0)")).toBe("other");
    expect(derivePlatform(null)).toBe("other");
  });
});
