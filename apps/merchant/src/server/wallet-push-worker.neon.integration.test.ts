import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "./db";
import {
  consumerAccounts,
  walletPasses,
  walletPushDevices,
  walletPushQueue,
} from "./schema";
import { ensureWalletPass } from "./wallet/core";
import { registerDevice } from "./wallet/passkit";
import { FakePushChannel } from "./wallet/push-channel";
import { COOLDOWN_MS, dispatchInline, deliverRow } from "./wallet/push";
import { runPushWorker } from "./wallet/push-worker";

const consumerIds: string[] = [];

/** A distinct-per-call epoch tag so `not_before` values never collide across tests. */
type EnqueueOpts = {
  title?: string;
  body?: string;
  notBefore?: Date;
  status?: "pending" | "sending" | "sent" | "failed";
};

async function enqueue(
  consumerId: string,
  klass: "transactional" | "campaign",
  opts: EnqueueOpts = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(walletPushQueue)
    .values({
      consumerId,
      class: klass,
      title: opts.title ?? "La Gringa",
      body: opts.body ?? "+1 sello",
      status: opts.status ?? "pending",
      notBefore: opts.notBefore ?? new Date(0),
    })
    .returning({ id: walletPushQueue.id });
  return row.id;
}

async function queueRow(id: string) {
  const [row] = await getDb()
    .select()
    .from(walletPushQueue)
    .where(eq(walletPushQueue.id, id));
  return row;
}

async function newConsumer() {
  const consumer = await seedConsumer();
  consumerIds.push(consumer.id);
  return consumer;
}

describe.skipIf(!integrationEnabled)(
  "wallet push worker/delivery against Neon (spec 0033)",
  () => {
    beforeAll(async () => {
      // Nothing global to seed; each test provisions its own consumer(s).
    }, 30_000);

    afterAll(async () => {
      const db = getDb();
      for (const id of consumerIds) {
        await db
          .delete(walletPushQueue)
          .where(eq(walletPushQueue.consumerId, id));
        // wallet_push_device cascades with the pass; delete passes then the account.
        await db.delete(walletPasses).where(eq(walletPasses.consumerId, id));
        await db.delete(consumerAccounts).where(eq(consumerAccounts.id, id));
      }
    }, 30_000);

    it("transactional sends immediately and preempts a queued campaign", async () => {
      const consumer = await newConsumer();
      const apple = await ensureWalletPass(consumer.id, "apple");
      await ensureWalletPass(consumer.id, "google");
      await registerDevice({
        passId: apple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "apns-live-token",
      });

      const campaignId = await enqueue(consumer.id, "campaign", {
        body: "Promo",
      });
      const txnId = await enqueue(consumer.id, "transactional");

      const now = new Date();
      const fake = new FakePushChannel();
      const summary = await runPushWorker({
        channel: fake,
        now,
        consumerIds: [consumer.id],
      });

      expect(summary.sent).toBe(1);
      expect(summary.rescheduled).toBe(1);

      // The transactional went out and closed.
      expect((await queueRow(txnId)).status).toBe("sent");

      // The campaign is preempted: still pending, pushed ~cooldown into the future.
      const camp = await queueRow(campaignId);
      expect(camp.status).toBe("pending");
      expect(camp.notBefore.getTime()).toBeGreaterThanOrEqual(
        now.getTime() + COOLDOWN_MS - 2000,
      );

      // The consumer's snapshot + cooldown base moved.
      const [acc] = await getDb()
        .select()
        .from(consumerAccounts)
        .where(eq(consumerAccounts.id, consumer.id));
      expect(acc.latestMessage).toBe("La Gringa: +1 sello");
      expect(acc.lastPushAt).not.toBeNull();

      // Both providers were hit for the transactional.
      expect(
        fake.calls.some(
          (c) => c.kind === "apple" && c.pushToken === "apns-live-token",
        ),
      ).toBe(true);
      expect(fake.calls.some((c) => c.kind === "google")).toBe(true);
    }, 30_000);

    it("cooldown: a campaign within the window is rescheduled, past it it sends", async () => {
      const consumer = await newConsumer();
      const campaignId = await enqueue(consumer.id, "campaign", {
        body: "Promo",
      });

      const now = new Date();
      // last push 1s ago → still inside cooldown → deferred.
      await getDb()
        .update(consumerAccounts)
        .set({ lastPushAt: new Date(now.getTime() - 1000) })
        .where(eq(consumerAccounts.id, consumer.id));

      const deferFake = new FakePushChannel();
      const deferred = await runPushWorker({
        channel: deferFake,
        now,
        consumerIds: [consumer.id],
      });
      expect(deferred.rescheduled).toBe(1);
      expect(deferred.sent).toBe(0);
      expect(deferFake.calls).toHaveLength(0);
      expect((await queueRow(campaignId)).status).toBe("pending");

      // Move the clock past the cooldown and make the row due again.
      await getDb()
        .update(walletPushQueue)
        .set({ notBefore: new Date(0), status: "pending" })
        .where(eq(walletPushQueue.id, campaignId));
      await getDb()
        .update(consumerAccounts)
        .set({ lastPushAt: new Date(now.getTime() - COOLDOWN_MS - 1000) })
        .where(eq(consumerAccounts.id, consumer.id));

      const sendFake = new FakePushChannel();
      const sentRun = await runPushWorker({
        channel: sendFake,
        now,
        consumerIds: [consumer.id],
      });
      expect(sentRun.sent).toBe(1);
      expect((await queueRow(campaignId)).status).toBe("sent");
    }, 30_000);

    it("claim is taken exactly once across inline dispatch and the cron worker", async () => {
      const consumer = await newConsumer();
      const apple = await ensureWalletPass(consumer.id, "apple");
      await registerDevice({
        passId: apple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "once-token",
      });
      const id = await enqueue(consumer.id, "transactional");

      const now = new Date();
      const fake = new FakePushChannel();
      await dispatchInline(id, { channel: fake, now });
      await runPushWorker({ channel: fake, now, consumerIds: [consumer.id] });

      const appleForToken = fake.calls.filter(
        (c) => c.kind === "apple" && c.pushToken === "once-token",
      );
      expect(appleForToken).toHaveLength(1); // delivered exactly once
      expect((await queueRow(id)).status).toBe("sent");
    }, 30_000);

    it("a 410 from APNs deletes the device row and the queue row still completes", async () => {
      const consumer = await newConsumer();
      const apple = await ensureWalletPass(consumer.id, "apple");
      await registerDevice({
        passId: apple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "gone-token",
      });
      const id = await enqueue(consumer.id, "transactional");

      const now = new Date();
      const fake = new FakePushChannel(new Set(["gone-token"]));
      await runPushWorker({ channel: fake, now, consumerIds: [consumer.id] });

      // The dead device was pruned...
      const devices = await getDb()
        .select()
        .from(walletPushDevices)
        .where(eq(walletPushDevices.walletPassId, apple.id));
      expect(devices).toHaveLength(0);
      // ...but the delivery still closed (one bad device never aborts the row).
      expect((await queueRow(id)).status).toBe("sent");
      expect(
        fake.calls.some(
          (c) => c.kind === "apple" && c.pushToken === "gone-token",
        ),
      ).toBe(true);
    }, 30_000);

    it("reaps a stale in-flight row but leaves a fresh in-flight one alone (Fix 2)", async () => {
      const now = new Date();

      // Consumer A: a `sending` row whose reclaim deadline already passed → reclaimed.
      const stale = await newConsumer();
      const staleApple = await ensureWalletPass(stale.id, "apple");
      await registerDevice({
        passId: staleApple.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "stale-token",
      });
      const staleId = await enqueue(stale.id, "transactional", {
        status: "sending",
        notBefore: new Date(now.getTime() - 60_000),
      });

      // Consumer B: a `sending` row still within its reclaim window → untouched.
      const fresh = await newConsumer();
      const freshNotBefore = new Date(now.getTime() + 600_000);
      const freshId = await enqueue(fresh.id, "transactional", {
        status: "sending",
        notBefore: freshNotBefore,
      });

      const fake = new FakePushChannel();
      await runPushWorker({
        channel: fake,
        now,
        consumerIds: [stale.id, fresh.id],
      });

      // Stale one was reclaimed and delivered.
      expect((await queueRow(staleId)).status).toBe("sent");
      expect(
        fake.calls.some(
          (c) => c.kind === "apple" && c.pushToken === "stale-token",
        ),
      ).toBe(true);

      // Fresh in-flight one was NOT re-picked.
      const freshRow = await queueRow(freshId);
      expect(freshRow.status).toBe("sending");
      expect(freshRow.notBefore.getTime()).toBe(freshNotBefore.getTime());
    }, 30_000);

    it("deliverRow re-claims a stale sending row directly (claim guard covers 'sending')", async () => {
      const consumer = await newConsumer();
      const now = new Date();
      const id = await enqueue(consumer.id, "transactional", {
        status: "sending",
        notBefore: new Date(now.getTime() - 60_000),
      });
      const fake = new FakePushChannel();
      const delivered = await deliverRow(id, { channel: fake, now });
      expect(delivered).toBe(true);
      expect((await queueRow(id)).status).toBe("sent");
    }, 30_000);
  },
);
