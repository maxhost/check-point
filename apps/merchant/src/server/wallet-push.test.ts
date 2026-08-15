import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApnsJwt, buildApnsRequest } from "./wallet/apns";
import {
  type QueueRow,
  buildTransactionalBody,
  planConsumerDrain,
} from "./wallet/push";
import {
  walletPushDeviceResponse,
  walletPushQueueResponse,
} from "./wallet/core";
import { createSlidingWindowLimiter } from "./wallet/pass-rate-limit";
import { buildAddMessageRequest } from "./wallet/google";

function ecKeypair() {
  return generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

describe("APNs provider JWT (ES256)", () => {
  it("is ES256/kid, iss=teamId, and its signature verifies with the public key", () => {
    const { publicKey, privateKey } = ecKeypair();
    const now = new Date(1_700_000_000_000);
    const jwt = buildApnsJwt(
      { keyId: "KEY123ABCD", teamId: "TEAM9876ZZ", p8Pem: privateKey },
      now,
    );
    const [header, payload, signature] = jwt.split(".");
    expect(header && payload && signature).toBeTruthy();

    const head = JSON.parse(Buffer.from(header, "base64url").toString());
    expect(head.alg).toBe("ES256");
    expect(head.kid).toBe("KEY123ABCD");

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.iss).toBe("TEAM9876ZZ");
    expect(claims.iat).toBe(1_700_000_000);

    // Verify the ES256 (raw R‖S) signature with the public half of the EC key.
    const verifier = createVerify("SHA256");
    verifier.update(`${header}.${payload}`);
    const ok = verifier.verify(
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    );
    expect(ok).toBe(true);
  });

  it("uses the Pass Type ID as apns-topic and an empty PassKit payload", () => {
    const req = buildApnsRequest({
      jwt: "jwt-token",
      passTypeId: "pass.com.checkpass.identity",
      pushToken: "device-abc",
    });
    expect(req.headers["apns-topic"]).toBe("pass.com.checkpass.identity");
    expect(req.headers.authorization).toBe("bearer jwt-token");
    expect(req.path).toBe("/3/device/device-abc");
    expect(req.payload).toBe("{}");
  });
});

describe("buildTransactionalBody", () => {
  it("pluralizes points/stamps by count", () => {
    expect(buildTransactionalBody(1, "stamps")).toBe("+1 sello");
    expect(buildTransactionalBody(3, "stamps")).toBe("+3 sellos");
    expect(buildTransactionalBody(1, "points")).toBe("+1 punto");
    expect(buildTransactionalBody(20, "points")).toBe("+20 puntos");
  });
});

const COOLDOWN = 3 * 60 * 1000;
function row(
  id: string,
  klass: "transactional" | "campaign",
  offsetMin: number,
): QueueRow {
  const t = new Date(1_700_000_000_000 + offsetMin * 60_000);
  return { id, consumerId: "c1", klass, notBefore: t, createdAt: t };
}

describe("planConsumerDrain (priority + cooldown + preemption)", () => {
  const now = new Date(1_700_000_500_000);

  it("sends transactional before campaign and preempts the campaign", () => {
    const rows = [row("camp", "campaign", 0), row("txn", "transactional", 0)];
    const actions = planConsumerDrain(rows, null, now, COOLDOWN);
    expect(actions[0]).toMatchObject({ kind: "send", row: { id: "txn" } });
    // The campaign is preempted: rescheduled to now + cooldown.
    expect(actions[1].kind).toBe("reschedule");
    if (actions[1].kind === "reschedule") {
      expect(actions[1].row.id).toBe("camp");
      expect(actions[1].notBefore.getTime()).toBe(now.getTime() + COOLDOWN);
    }
  });

  it("a transactional always sends even within the cooldown window", () => {
    const lastPush = new Date(now.getTime() - 1000); // 1s ago, inside cooldown
    const actions = planConsumerDrain(
      [row("txn", "transactional", 0)],
      lastPush,
      now,
      COOLDOWN,
    );
    expect(actions[0]).toMatchObject({ kind: "send", row: { id: "txn" } });
  });

  it("defers a campaign that is still within cooldown, sends one past it", () => {
    const recent = new Date(now.getTime() - 1000);
    const deferred = planConsumerDrain(
      [row("camp", "campaign", 0)],
      recent,
      now,
      COOLDOWN,
    );
    expect(deferred[0].kind).toBe("reschedule");

    const old = new Date(now.getTime() - COOLDOWN - 1000);
    const sent = planConsumerDrain(
      [row("camp", "campaign", 0)],
      old,
      now,
      COOLDOWN,
    );
    expect(sent[0].kind).toBe("send");
  });

  it("two campaigns: the first sends, the second waits the cooldown", () => {
    const rows = [row("c1", "campaign", -2), row("c2", "campaign", -1)];
    const actions = planConsumerDrain(rows, null, now, COOLDOWN);
    expect(actions[0]).toMatchObject({ kind: "send", row: { id: "c1" } });
    expect(actions[1].kind).toBe("reschedule");
  });
});

describe("push DTOs never leak tokens", () => {
  it("walletPushDeviceResponse omits push_token and wallet_pass_id", () => {
    const dto = walletPushDeviceResponse({
      id: "dev-1",
      walletPassId: "pass-1",
      deviceLibraryId: "dev-lib",
      pushToken: "SECRET-APNS-PUSH-TOKEN",
      createdAt: new Date("2026-08-14T00:00:00Z"),
      updatedAt: new Date("2026-08-14T00:00:00Z"),
    });
    expect(dto).not.toHaveProperty("pushToken");
    expect(dto).not.toHaveProperty("walletPassId");
    expect(JSON.stringify(dto)).not.toContain("SECRET-APNS-PUSH-TOKEN");
    expect(dto).toMatchObject({ id: "dev-1", deviceLibraryId: "dev-lib" });
  });

  it("walletPushQueueResponse omits consumerId (no token columns to begin with)", () => {
    const dto = walletPushQueueResponse({
      id: "q-1",
      consumerId: "SECRET-CONSUMER-ID",
      class: "transactional",
      title: "La Gringa",
      body: "+1 sello",
      status: "pending",
      notBefore: new Date("2026-08-14T00:00:00Z"),
      attempts: 0,
      lastError: null,
      createdAt: new Date("2026-08-14T00:00:00Z"),
      sentAt: null,
    });
    expect(dto).not.toHaveProperty("consumerId");
    expect(JSON.stringify(dto)).not.toContain("SECRET-CONSUMER-ID");
    expect(dto).toMatchObject({ id: "q-1", class: "transactional" });
  });
});

describe("PassKit rate limiter (by serial, injectable clock/store)", () => {
  it("allows up to max then 429s within the window", () => {
    const limiter = createSlidingWindowLimiter({ max: 3, windowMs: 1000 });
    expect(limiter.check("serial-A", 0)).toBe(true);
    expect(limiter.check("serial-A", 100)).toBe(true);
    expect(limiter.check("serial-A", 200)).toBe(true);
    expect(limiter.check("serial-A", 300)).toBe(false); // over the limit
    // A different serial has its own window.
    expect(limiter.check("serial-B", 300)).toBe(true);
    // Past the window, the earlier hits fall off.
    expect(limiter.check("serial-A", 1500)).toBe(true);
  });
});

describe("Google addMessage request shape", () => {
  it("targets the loyaltyObject addMessage endpoint with header/body", () => {
    const req = buildAddMessageRequest("3388000000012345678", "serial-xyz", {
      header: "La Gringa",
      body: "+1 sello",
    });
    expect(req.url).toContain(
      "/loyaltyObject/3388000000012345678.serial-xyz/addMessage",
    );
    expect(req.body).toMatchObject({
      // messageType TEXT_AND_NOTIFY is what makes Google raise a push notification
      // (plain TEXT appends silently) — assert it so a regression can't mute the push.
      message: {
        header: "La Gringa",
        body: "+1 sello",
        messageType: "TEXT_AND_NOTIFY",
      },
    });
  });
});
