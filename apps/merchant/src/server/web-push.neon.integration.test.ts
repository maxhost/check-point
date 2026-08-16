import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import { enqueue, queueRow } from "./wallet-push-integration-support";
import { getDb } from "./db";
import { consumerAccounts, walletPasses, webPushSubscriptions } from "./schema";
import { ensureWalletPass } from "./wallet/core";
import { registerDevice } from "./wallet/passkit";
import { issueSession } from "./consumer/session";
import { SESSION_COOKIE } from "./consumer/core";
import {
  deliverWebPush,
  listConsumerSubscriptions,
  purgeConsumerSubscriptions,
  upsertSubscription,
} from "./push/subscriptions";
import { FakeWebPushChannel } from "./push/webpush-channel";
import { FakePushChannel } from "./wallet/push-channel";
import { runPushWorker } from "./wallet/push-worker";
import { rotatePassCredentials } from "./wallet/push";
import { POST as subscribePost } from "../app/api/public/push/subscribe/route";

const consumerIds: string[] = [];

async function newConsumer() {
  const consumer = await seedConsumer();
  consumerIds.push(consumer.id);
  return consumer;
}

/** Builds a POST /subscribe request with an optional consumer session cookie. */
function subscribeRequest(
  body: unknown,
  sessionToken?: string,
  userAgent = "Mozilla/5.0 (Linux; Android 14)",
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": userAgent,
  };
  if (sessionToken) headers.cookie = `${SESSION_COOKIE}=${sessionToken}`;
  return new NextRequest("https://mp.test/api/public/push/subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function subPayload(endpoint: string) {
  return { endpoint, keys: { p256dh: `p256dh-${endpoint}`, auth: "auth-key" } };
}

describe.skipIf(!integrationEnabled)(
  "web push subscriptions against Neon (spec 0037)",
  () => {
    beforeAll(async () => {
      // Each test provisions its own consumer(s).
    }, 30_000);

    afterAll(async () => {
      const db = getDb();
      for (const id of consumerIds) {
        await db
          .delete(webPushSubscriptions)
          .where(eq(webPushSubscriptions.consumerId, id));
        await db.delete(walletPasses).where(eq(walletPasses.consumerId, id));
        await db.delete(consumerAccounts).where(eq(consumerAccounts.id, id));
      }
    }, 30_000);

    it("subscribe route associates the row to the SESSION consumer and hides the keys", async () => {
      const consumer = await newConsumer();
      const token = await issueSession(consumer.id);
      const endpoint = `https://push.test/${randomUUID()}`;

      const res = await subscribePost(
        subscribeRequest(subPayload(endpoint), token),
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        subscription: Record<string, unknown>;
      };
      // Anti-leak: the response carries no endpoint/p256dh/auth.
      const asText = JSON.stringify(json);
      expect(asText).not.toContain(endpoint);
      expect(asText).not.toContain("p256dh-");
      expect(asText).not.toContain("auth-key");
      expect(json.subscription.platform).toBe("android");

      const rows = await listConsumerSubscriptions(consumer.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].endpoint).toBe(endpoint);
      expect(rows[0].consumerId).toBe(consumer.id);
    }, 30_000);

    it("no session → 401; a bad body → 400", async () => {
      const noAuth = await subscribePost(
        subscribeRequest(subPayload("https://push.test/x")),
      );
      expect(noAuth.status).toBe(401);

      const consumer = await newConsumer();
      const token = await issueSession(consumer.id);
      const bad = await subscribePost(subscribeRequest({ nope: 1 }, token));
      expect(bad.status).toBe(400);
    }, 30_000);

    it("upsert is idempotent by endpoint and follows the session (isolation)", async () => {
      const a = await newConsumer();
      const b = await newConsumer();
      const tokenA = await issueSession(a.id);
      const tokenB = await issueSession(b.id);
      const endpoint = `https://push.test/${randomUUID()}`;

      // A subscribes twice with the same endpoint → one row, still A's.
      await subscribePost(subscribeRequest(subPayload(endpoint), tokenA));
      await subscribePost(subscribeRequest(subPayload(endpoint), tokenA));
      expect(await listConsumerSubscriptions(a.id)).toHaveLength(1);

      // B posts the SAME endpoint under B's session → it moves to B (endpoint unique),
      // and B can never target A: the row's owner is always the session consumer.
      await subscribePost(subscribeRequest(subPayload(endpoint), tokenB));
      expect(await listConsumerSubscriptions(a.id)).toHaveLength(0);
      const bRows = await listConsumerSubscriptions(b.id);
      expect(bRows).toHaveLength(1);
      expect(bRows[0].consumerId).toBe(b.id);
    }, 30_000);

    it("a 404/410 from the push service deletes the subscription row", async () => {
      const consumer = await newConsumer();
      const endpoint = `https://push.test/${randomUUID()}`;
      await upsertSubscription({
        consumerId: consumer.id,
        endpoint,
        p256dhKey: "p256dh",
        authKey: "auth",
        userAgent: "UA",
      });
      const gone = new FakeWebPushChannel(new Set([endpoint]));
      const errors = await deliverWebPush(
        consumer.id,
        { title: "T", body: "B" },
        gone,
      );
      expect(errors).toHaveLength(0); // a gone endpoint is pruned, not an error
      expect(await listConsumerSubscriptions(consumer.id)).toHaveLength(0);
    }, 30_000);

    it("rotatePassCredentials purges the consumer's subscriptions", async () => {
      const consumer = await newConsumer();
      await upsertSubscription({
        consumerId: consumer.id,
        endpoint: `https://push.test/${randomUUID()}`,
        p256dhKey: "p256dh",
        authKey: "auth",
        userAgent: "UA",
      });
      expect(await listConsumerSubscriptions(consumer.id)).toHaveLength(1);
      await rotatePassCredentials(consumer.id);
      expect(await listConsumerSubscriptions(consumer.id)).toHaveLength(0);
      // Idempotent purge helper.
      expect(await purgeConsumerSubscriptions(consumer.id)).toBe(0);
    }, 30_000);

    // A `campaign` keeps the ADR 0038 fan-out (wallet + Web Push). The transactional NO
    // LONGER fans out (spec 0038 / ADR 0040 routes it by class: wallet, else Web Push
    // fallback — never both); that contract is proven in
    // `wallet-push-routing.neon.integration.test.ts`.
    it("a campaign fans out by webpush AND wallet and counts as ONE cooldown/queue row", async () => {
      const consumer = await newConsumer();
      const apple = await ensureWalletPass(consumer.id, "apple");
      await ensureWalletPass(consumer.id, "google");
      await registerDevice({
        passId: apple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "apns-fanout",
      });
      const endpoint = `https://push.test/${randomUUID()}`;
      await upsertSubscription({
        consumerId: consumer.id,
        endpoint,
        p256dhKey: "p256dh",
        authKey: "auth",
        userAgent: "UA",
      });
      const id = await enqueue(consumer.id, "campaign");

      const walletFake = new FakePushChannel();
      const webFake = new FakeWebPushChannel();
      const summary = await runPushWorker({
        channel: walletFake,
        webPushChannel: webFake,
        now: new Date(),
        consumerIds: [consumer.id],
      });

      // Exactly one queue row sent → the cooldown counts the multi-transport notice once.
      expect(summary.sent).toBe(1);
      expect((await queueRow(id)).status).toBe("sent");

      // All three transports were hit for the single notice.
      expect(
        walletFake.calls.some(
          (c) => c.kind === "apple" && c.pushToken === "apns-fanout",
        ),
      ).toBe(true);
      expect(walletFake.calls.some((c) => c.kind === "google")).toBe(true);
      expect(webFake.calls.some((c) => c.endpoint === endpoint)).toBe(true);

      // The cooldown base moved exactly once.
      const [acc] = await getDb()
        .select()
        .from(consumerAccounts)
        .where(eq(consumerAccounts.id, consumer.id));
      expect(acc.lastPushAt).not.toBeNull();
    }, 30_000);
  },
);
