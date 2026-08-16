import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import { enqueue, queueRow } from "./wallet-push-integration-support";
import { getDb } from "./db";
import {
  consumerAccounts,
  walletPasses,
  walletPushQueue,
  webPushSubscriptions,
} from "./schema";
import { ensureWalletPass } from "./wallet/core";
import { registerDevice } from "./wallet/passkit";
import { upsertSubscription } from "./push/subscriptions";
import { FakePushChannel } from "./wallet/push-channel";
import { FakeWebPushChannel } from "./push/webpush-channel";
import { consumerHasReachableWallet } from "./wallet/push-transports";
import { runPushWorker } from "./wallet/push-worker";

// Routing of the transactional by class (spec 0038 / ADR 0040): wallet when the consumer
// has a reachable pass, Web Push ONLY as fallback — the two never coexist, so the QA
// duplicate (pass + Web Push on the same event) can no longer happen. Split out of
// `wallet-push-worker.neon.integration.test.ts` to stay under the file-size budget.

const consumerIds: string[] = [];

async function newConsumer() {
  const consumer = await seedConsumer();
  consumerIds.push(consumer.id);
  return consumer;
}

async function subscribe(consumerId: string): Promise<string> {
  const endpoint = `https://push.test/${randomUUID()}`;
  await upsertSubscription({
    consumerId,
    endpoint,
    p256dhKey: "p256dh",
    authKey: "auth",
    userAgent: "UA",
  });
  return endpoint;
}

describe.skipIf(!integrationEnabled)(
  "transactional transport routing by class against Neon (spec 0038)",
  () => {
    afterAll(async () => {
      const db = getDb();
      for (const id of consumerIds) {
        await db
          .delete(webPushSubscriptions)
          .where(eq(webPushSubscriptions.consumerId, id));
        await db
          .delete(walletPushQueue)
          .where(eq(walletPushQueue.consumerId, id));
        // wallet_push_device cascades with the pass; delete passes then the account.
        await db.delete(walletPasses).where(eq(walletPasses.consumerId, id));
        await db.delete(consumerAccounts).where(eq(consumerAccounts.id, id));
      }
    }, 30_000);

    it("consumerHasReachableWallet: Apple device → true, Google pass → true, neither → false", async () => {
      // Apple pass WITH a registered device → reachable.
      const withApple = await newConsumer();
      const apple = await ensureWalletPass(withApple.id, "apple");
      await registerDevice({
        passId: apple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "reach-apns",
      });
      expect(await consumerHasReachableWallet(withApple.id)).toBe(true);

      // Google pass (no device row needed) → reachable.
      const withGoogle = await newConsumer();
      await ensureWalletPass(withGoogle.id, "google");
      expect(await consumerHasReachableWallet(withGoogle.id)).toBe(true);

      // An Apple pass with NO device is NOT reachable; neither is a passless consumer.
      const applePassNoDevice = await newConsumer();
      await ensureWalletPass(applePassNoDevice.id, "apple");
      expect(await consumerHasReachableWallet(applePassNoDevice.id)).toBe(
        false,
      );

      const none = await newConsumer();
      expect(await consumerHasReachableWallet(none.id)).toBe(false);
    }, 30_000);

    it("reachable wallet → delivers ONLY wallet (no Web Push) in one cooldown", async () => {
      const consumer = await newConsumer();
      const apple = await ensureWalletPass(consumer.id, "apple");
      await ensureWalletPass(consumer.id, "google");
      await registerDevice({
        passId: apple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "route-apns",
      });
      // The consumer ALSO has a Web Push subscription — routing, not availability, must
      // keep it silent for the transactional (this is exactly the QA duplicate).
      const endpoint = await subscribe(consumer.id);
      const id = await enqueue(consumer.id, "transactional");

      const walletFake = new FakePushChannel();
      const webFake = new FakeWebPushChannel();
      const summary = await runPushWorker({
        channel: walletFake,
        webPushChannel: webFake,
        now: new Date(),
        consumerIds: [consumer.id],
      });

      // Exactly one queue row sent → the cooldown counts the notice once.
      expect(summary.sent).toBe(1);
      expect((await queueRow(id)).status).toBe("sent");

      // Wallet was hit; Web Push was NOT (no duplicate).
      expect(
        walletFake.calls.some(
          (c) => c.kind === "apple" && c.pushToken === "route-apns",
        ),
      ).toBe(true);
      expect(walletFake.calls.some((c) => c.kind === "google")).toBe(true);
      expect(webFake.calls).toHaveLength(0);
      // The endpoint exists, so its silence is the routing decision, not a missing sub.
      expect(webFake.calls.some((c) => c.endpoint === endpoint)).toBe(false);
    }, 30_000);

    it("no reachable wallet → falls back to Web Push only (no wallet call)", async () => {
      // No pass at all, only a Web Push subscription → fallback fires by Web Push, and no
      // wallet call is even attempted.
      const consumer = await newConsumer();
      const endpoint = await subscribe(consumer.id);
      const id = await enqueue(consumer.id, "transactional");

      const walletFake = new FakePushChannel();
      const webFake = new FakeWebPushChannel();
      const summary = await runPushWorker({
        channel: walletFake,
        webPushChannel: webFake,
        now: new Date(),
        consumerIds: [consumer.id],
      });

      expect(summary.sent).toBe(1);
      expect((await queueRow(id)).status).toBe("sent");

      // Web Push fired; the wallet channel was never called.
      expect(webFake.calls.some((c) => c.endpoint === endpoint)).toBe(true);
      expect(walletFake.calls).toHaveLength(0);
    }, 30_000);
  },
);
