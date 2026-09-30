import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  readBalances,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { enqueue, queueRow } from "./wallet-push-integration-support";
import { getDb } from "./db";
import { consumerAccounts, walletPasses, walletPushQueue } from "./schema";
import { resolveScan } from "./counter/resolve";
import { persistGrant } from "./counter/orders";
import { ensureWalletPass } from "./wallet/core";
import { FakePushChannel } from "./wallet/push-channel";
import { deliverRow } from "./wallet/push";

/**
 * The 24 h notice budget WIRED into the delivery (spec 0111 D3), against real rows. This is
 * the oracle of the cableado (ORACULO DE M3 and M4): the pure table lives in
 * `wallet-push-budget.test.ts` and cannot see `deliverClaimed` stop asking it.
 */

const HOUR = 60 * 60 * 1000;
const consumerIds: string[] = [];

/** Local clock slightly ahead of the DB's `now()` so rows queued with `not_before =
 * now()` are always due (clock skew between this machine and Neon). */
function clock(offsetMs = 0): Date {
  return new Date(Date.now() + 60_000 + offsetMs);
}

async function consumerWithGooglePass() {
  const consumer = await seedConsumer();
  consumerIds.push(consumer.id);
  await ensureWalletPass(consumer.id, "google");
  return consumer;
}

/** A row already delivered with sound (or silently) at `sentAt`. */
async function sentRow(
  consumerId: string,
  klass: "transactional" | "campaign" | "pass_refresh" | "reminder",
  sentAt: Date,
): Promise<void> {
  await getDb()
    .insert(walletPushQueue)
    .values({
      consumerId,
      class: klass,
      title: "La Gringa",
      body: "antes",
      status: "sent",
      notBefore: new Date(sentAt.getTime() - HOUR),
      sentAt,
    });
}

async function account(consumerId: string) {
  const [row] = await getDb()
    .select()
    .from(consumerAccounts)
    .where(eq(consumerAccounts.id, consumerId));
  return row;
}

describe.skipIf(!integrationEnabled)(
  "the 24 h notice budget in the delivery (spec 0111)",
  () => {
    let seed: Seed;

    beforeAll(async () => {
      seed = await seedBusiness({
        name: "La Gringa",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
    }, 30_000);

    afterAll(async () => {
      const db = getDb();
      for (const id of consumerIds)
        await db
          .delete(walletPushQueue)
          .where(eq(walletPushQueue.consumerId, id));
      await dropBusiness(seed.business.id);
      for (const id of consumerIds) {
        await db.delete(walletPasses).where(eq(walletPasses.consumerId, id));
        await db.delete(consumerAccounts).where(eq(consumerAccounts.id, id));
      }
    }, 30_000);

    it("3 accreditations in a row: 2 ring, the 3rd is credited in silence", async () => {
      const consumer = await consumerWithGooglePass();
      const resolved = await resolveScan(seed.business, consumer.qrToken);
      const membershipId = resolved.membership.id;
      const ids: string[] = [];
      const times: Date[] = [];
      const fakes: FakePushChannel[] = [];
      // Different units → different texts, so `latest_message` tells the 2nd from the 3rd.
      for (const units of [1, 2, 3]) {
        const granted = await persistGrant({
          businessId: seed.business.id,
          locationId: seed.locationId,
          programId: seed.programId,
          membershipId,
          consumerId: consumer.id,
          mode: "quick",
          total: "9.00",
          currencyCode: "USD",
          note: null,
          accrualKind: "stamps",
          units,
          createdByUserId: seed.userId,
          clientRequestId: randomUUID(),
          items: [],
        });
        expect(granted?.pushQueueId).toBeTruthy();
        const now = clock(units * 1000);
        const fake = new FakePushChannel();
        expect(
          await deliverRow(granted!.pushQueueId!, {
            channel: fake,
            webPushChannel: null,
            now,
          }),
        ).toBe(true);
        ids.push(granted!.pushQueueId!);
        times.push(now);
        fakes.push(fake);
      }

      const rows = await Promise.all(ids.map(queueRow));
      expect(rows.map((r) => r.status)).toEqual(["sent", "sent", "suppressed"]);
      expect(rows[2].lastError).toBe("budget_24h");
      expect(rows[2].sentAt).toBeNull();
      // The 3rd reached NO transport.
      expect(fakes[0].calls.map((c) => c.kind)).toEqual(["google"]);
      expect(fakes[1].calls.map((c) => c.kind)).toEqual(["google"]);
      expect(fakes[2].calls).toEqual([]);

      // The account shows the 2nd notice, stamped at the 2nd delivery — not the 3rd.
      const acct = await account(consumer.id);
      expect(acct.latestMessage).toBe(
        "La Gringa: Se acreditaron 2 sellos en tu cuenta 🎉 · Revisa tus beneficios en checkpass.club",
      );
      expect(acct.lastPushAt?.getTime()).toBe(times[1].getTime());
      expect(acct.messageUpdatedAt?.getTime()).toBe(times[1].getTime());

      // The balance DID take all three.
      expect(await readBalances(membershipId)).toEqual({
        points: 0,
        stamps: 6,
      });
    }, 60_000);

    it("with 3 notifying sent (any mix), a campaign is deferred to oldest + 24 h", async () => {
      const consumer = await consumerWithGooglePass();
      const now = clock();
      const oldest = new Date(now.getTime() - 20 * HOUR);
      await sentRow(consumer.id, "reminder", oldest);
      await sentRow(
        consumer.id,
        "campaign",
        new Date(now.getTime() - 10 * HOUR),
      );
      await sentRow(
        consumer.id,
        "transactional",
        new Date(now.getTime() - HOUR),
      );
      const id = await enqueue(consumer.id, "campaign", { body: "Promo" });
      const fake = new FakePushChannel();
      await deliverRow(id, { channel: fake, webPushChannel: null, now });
      const row = await queueRow(id);
      expect(row.status).toBe("pending");
      expect(row.notBefore.getTime()).toBe(oldest.getTime() + 24 * HOUR);
      expect(fake.calls).toEqual([]);
    }, 60_000);

    it("with 3 notifying sent, a reminder is suppressed and a pass_refresh still goes", async () => {
      const consumer = await consumerWithGooglePass();
      const now = clock();
      for (const h of [1, 2, 3])
        await sentRow(
          consumer.id,
          "campaign",
          new Date(now.getTime() - h * HOUR),
        );
      const reminderId = await enqueue(consumer.id, "transactional");
      await getDb()
        .update(walletPushQueue)
        .set({ class: "reminder" })
        .where(eq(walletPushQueue.id, reminderId));
      await deliverRow(reminderId, {
        channel: new FakePushChannel(),
        webPushChannel: null,
        now,
      });
      expect((await queueRow(reminderId)).status).toBe("suppressed");

      const refreshId = await enqueue(consumer.id, "pass_refresh", {
        title: "",
        body: "",
      });
      const fake = new FakePushChannel();
      await deliverRow(refreshId, { channel: fake, webPushChannel: null, now });
      expect((await queueRow(refreshId)).status).toBe("sent");
      expect(fake.calls.map((c) => c.kind)).toEqual(["google-patch"]);
    }, 60_000);

    it("the window is `sent_at > now − 24 h`: a send exactly 24 h old no longer counts", async () => {
      const consumer = await consumerWithGooglePass();
      const now = clock();
      await sentRow(
        consumer.id,
        "transactional",
        new Date(now.getTime() - 24 * HOUR),
      );
      await sentRow(
        consumer.id,
        "transactional",
        new Date(now.getTime() - HOUR),
      );
      // pass_refresh rows never count, however many.
      for (const h of [2, 3, 4])
        await sentRow(
          consumer.id,
          "pass_refresh",
          new Date(now.getTime() - h * HOUR),
        );
      const id = await enqueue(consumer.id, "transactional");
      await deliverRow(id, {
        channel: new FakePushChannel(),
        webPushChannel: null,
        now,
      });
      expect((await queueRow(id)).status).toBe("sent");
    }, 60_000);
  },
);
