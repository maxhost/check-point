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
} from "@mi-pasaporte/db/schema";
import { resolveScan } from "./counter/resolve";
import { persistGrant } from "./counter/orders";
import { ensureWalletPass } from "@mi-pasaporte/domain/server/wallet/core";
import { FakePushChannel } from "./wallet/push-channel";
import { FakeWebPushChannel } from "@mi-pasaporte/domain/server/push/webpush-channel";
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

    // Spec 0139: rewritten to the new route. It asserted the Google `addMessage` per
    // delivery and `latest_message` = the 2nd notice; a counter notice now rings by Web
    // Push only (the consumer gets a subscription) and never writes «Última novedad».
    it("3 accreditations in a row: 2 ring, the 3rd is credited in silence", async () => {
      const consumer = await consumerWithGooglePass();
      await subscribe(consumer.id);
      const before = await account(consumer.id);
      const resolved = await resolveScan(seed.business, consumer.qrToken);
      const membershipId = resolved.membership.id;
      const ids: string[] = [];
      const times: Date[] = [];
      const fakes: FakePushChannel[] = [];
      const webFakes: FakeWebPushChannel[] = [];
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
        const webFake = new FakeWebPushChannel();
        expect(
          await deliverRow(granted!.pushQueueId!, {
            channel: fake,
            webPushChannel: webFake,
            now,
          }),
        ).toBe(true);
        ids.push(granted!.pushQueueId!);
        times.push(now);
        fakes.push(fake);
        webFakes.push(webFake);
      }

      const rows = await Promise.all(ids.map(queueRow));
      expect(rows.map((r) => r.status)).toEqual(["sent", "sent", "suppressed"]);
      expect(rows[2].lastError).toBe("budget_24h");
      expect(rows[2].sentAt).toBeNull();
      // The first two rang by Web Push, the 3rd reached NO transport, the wallet none.
      expect(webFakes.map((f) => f.calls.length)).toEqual([1, 1, 0]);
      expect(fakes.flatMap((f) => f.calls)).toEqual([]);

      // The clock is the 2nd delivery's; the pass's «Última novedad» is untouched.
      const acct = await account(consumer.id);
      expect(acct.latestMessage).toBe(before.latestMessage);
      expect(acct.messageUpdatedAt?.getTime()).toBe(
        before.messageUpdatedAt?.getTime(),
      );
      expect(acct.lastPushAt?.getTime()).toBe(times[1].getTime());

      // The balance DID take all three.
      expect(await readBalances(membershipId)).toEqual({
        points: 0,
        stamps: 6,
      });
    }, 60_000);

    // Spec 0139: + a Web Push subscription (without one the campaign closes `no_channel`
    // before the budget is asked); what it asserts is unchanged.
    it("with 3 notifying sent (any mix), a campaign is deferred to oldest + 24 h", async () => {
      const consumer = await consumerWithGooglePass();
      await subscribe(consumer.id);
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
      const before = await account(consumer.id);
      await deliverRow(reminderId, {
        channel: new FakePushChannel(),
        webPushChannel: null,
        now,
      });
      expect((await queueRow(reminderId)).status).toBe("suppressed");
      // Spec 0139: the reminder is the only class that writes the «Última novedad»; a SUPPRESSED
      // one must not, or Apple rings with it on the next pass download despite the budget.
      expect((await account(consumer.id)).latestMessage).toBe(
        before.latestMessage,
      );

      const refreshId = await enqueue(consumer.id, "pass_refresh", {
        title: "",
        body: "",
      });
      const fake = new FakePushChannel();
      await deliverRow(refreshId, { channel: fake, webPushChannel: null, now });
      expect((await queueRow(refreshId)).status).toBe("sent");
      expect(fake.calls.map((c) => c.kind)).toEqual(["google-patch"]);
    }, 60_000);

    // Spec 0139: + a Web Push subscription (without one the counter notice closes
    // `no_channel`, not `sent`); what it asserts is unchanged.
    it("the window is `sent_at > now − 24 h`: a send exactly 24 h old no longer counts", async () => {
      const consumer = await consumerWithGooglePass();
      await subscribe(consumer.id);
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
