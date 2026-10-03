import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import {
  enqueue,
  queueRow,
  subscribe,
} from "./wallet-push-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  consumerAccounts,
  walletPasses,
  walletPushQueue,
  webPushSubscriptions,
} from "@mi-pasaporte/db/schema";
import { ensureWalletPass } from "@mi-pasaporte/domain/server/wallet/core";
import { registerDevice } from "@mi-pasaporte/domain/server/wallet/passkit";
import { FakePushChannel } from "./wallet/push-channel";
import { FakeWebPushChannel } from "@mi-pasaporte/domain/server/push/webpush-channel";
import { consumerHasReachableWallet } from "./wallet/push-transports";
import { runPushWorker } from "./wallet/push-worker";

// Routing of the counter notice (spec 0139 / ADR 0115 §2): Web Push only, never the
// wallet — so the QA duplicate (pass + Web Push on the same event) cannot happen either.
// The no-channel close, the «Última novedad» and the reminder route live in
// `wallet-push-channels.neon.integration.test.ts`. Split out of
// `wallet-push-worker.neon.integration.test.ts` to stay under the file-size budget.

const consumerIds: string[] = [];

async function newConsumer() {
  const consumer = await seedConsumer();
  consumerIds.push(consumer.id);
  return consumer;
}

describe.skipIf(!integrationEnabled)(
  "transactional transport routing by class against Neon (spec 0038 / 0139)",
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

    // Spec 0139: rewritten to the new route. It asserted «reachable wallet → wallet only, no
    // Web Push»; since ADR 0115 §2 a counter notice goes by the PWA and NEVER by wallet.
    // ORACULO DE M1.
    it("counter notice with a reachable Apple+Google pass AND a subscription → ONLY Web Push", async () => {
      const consumer = await newConsumer();
      const apple = await ensureWalletPass(consumer.id, "apple");
      await ensureWalletPass(consumer.id, "google");
      await registerDevice({
        passId: apple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "route-apns",
      });
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
      // Web Push was hit; NO APNs and NO addMessage, although the pass is reachable.
      expect(webFake.calls.some((c) => c.endpoint === endpoint)).toBe(true);
      expect(walletFake.calls).toEqual([]);
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
