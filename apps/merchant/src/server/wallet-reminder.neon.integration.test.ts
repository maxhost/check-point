import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import {
  type CouponWorld,
  dropCouponWorld,
  newCouponCard,
  seedCouponWorld,
} from "./counter-coupon-support";
import { getDb } from "@mi-pasaporte/db";
import {
  consumerAccounts,
  orders,
  walletPasses,
  walletPushQueue,
} from "@mi-pasaporte/db/schema";
import { persistGrant } from "./counter/orders";
import { ensureWalletPass } from "@mi-pasaporte/domain/server/wallet/core";
import { FakePushChannel } from "./wallet/push-channel";
import { runPushWorker } from "./wallet/push-worker";
import {
  markAccountOpened,
  planReminders,
} from "@mi-pasaporte/domain/server/wallet/reminder-store";
import { REMINDER_BODIES } from "@mi-pasaporte/domain/server/wallet/reminder";

/**
 * The reminder planner against real rows (spec 0111 D5 + D7). `staleRead` simulates the
 * decision of a run that loaded its candidates BEFORE another run queued the reminder (two
 * overlapping cron passes): with it on, the 20 h rule of the pure decision cannot see the
 * row, and only the `not exists` of the insert keeps the second one out (ORACULO DE M6).
 */
const flags = vi.hoisted(() => ({ staleRead: false }));
vi.mock(
  "@mi-pasaporte/domain/server/wallet/reminder",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@mi-pasaporte/domain/server/wallet/reminder")
      >();
    return {
      ...actual,
      decideReminder: (
        input: Parameters<typeof actual.decideReminder>[0],
        now: Date,
      ) =>
        actual.decideReminder(
          flags.staleRead ? { ...input, lastReminderAt: null } : input,
          now,
        ),
    };
  },
);

const HOUR = 60 * 60 * 1000;
const consumerIds: string[] = [];

/** The next 23:00Z (18:00 in Guayaquil, past the default 12:30 target) at least a minute
 * ahead of the real clock, so every row seeded with the DB's `now()` is in its past. */
function eveningNow(): Date {
  const at = new Date(Date.now() + 60_000);
  const target = new Date(at);
  target.setUTCHours(23, 0, 0, 0);
  if (target.getTime() < at.getTime())
    target.setUTCDate(target.getUTCDate() + 1);
  return target;
}

async function reminderRows(consumerId: string) {
  return getDb()
    .select()
    .from(walletPushQueue)
    .where(
      and(
        eq(walletPushQueue.consumerId, consumerId),
        eq(walletPushQueue.class, "reminder"),
      ),
    );
}

async function openedAt(consumerId: string) {
  const [row] = await getDb()
    .select({ at: consumerAccounts.lastOpenedAt })
    .from(consumerAccounts)
    .where(eq(consumerAccounts.id, consumerId));
  return row.at;
}

describe.skipIf(!integrationEnabled)(
  "the day-without-purchase reminder (spec 0111)",
  () => {
    let world: CouponWorld;

    async function couponCard() {
      const card = await newCouponCard(world);
      consumerIds.push(card.consumerId);
      await ensureWalletPass(card.consumerId, "google");
      return card;
    }
    const couponConsumer = async () => (await couponCard()).consumerId;

    beforeAll(async () => {
      world = await seedCouponWorld("Recordatorio");
    }, 60_000);

    afterAll(async () => {
      const db = getDb();
      for (const id of consumerIds)
        await db
          .delete(walletPushQueue)
          .where(eq(walletPushQueue.consumerId, id));
      await dropCouponWorld(world);
      for (const id of consumerIds) {
        await db.delete(walletPasses).where(eq(walletPasses.consumerId, id));
        await db.delete(consumerAccounts).where(eq(consumerAccounts.id, id));
      }
    }, 60_000);

    it("a consumer with a new coupon gets ONE reminder; a second run adds none", async () => {
      const id = await couponConsumer();
      const now = eveningNow();
      expect(await planReminders(now, [id])).toEqual({ planned: 1 });
      expect(await planReminders(now, [id])).toEqual({ planned: 0 });
      const rows = await reminderRows(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "pending",
        title: "CheckPass",
        body: REMINDER_BODIES.coupon_new,
      });
      expect(rows[0].notBefore.getTime()).toBe(now.getTime());
    }, 60_000);

    it("even when the decision was taken on a stale read, the insert queues no second one", async () => {
      const id = await couponConsumer();
      const now = eveningNow();
      flags.staleRead = true;
      try {
        expect(await planReminders(now, [id])).toEqual({ planned: 1 });
        expect(await planReminders(now, [id])).toEqual({ planned: 0 });
      } finally {
        flags.staleRead = false;
      }
      expect(await reminderRows(id)).toHaveLength(1);
    }, 60_000);

    // ORACULO DE M5 (integration half): the coupon is there, only the scan holds it back.
    it("a scan 2 h ago (a day WITH purchase) → no reminder", async () => {
      const card = await couponCard();
      const id = card.consumerId;
      const now = eveningNow();
      const granted = await persistGrant({
        businessId: world.seed.business.id,
        locationId: world.seed.locationId,
        programId: world.seed.programId,
        membershipId: card.membershipId,
        consumerId: id,
        mode: "quick",
        total: "9.00",
        currencyCode: "USD",
        note: null,
        accrualKind: "points",
        units: 10,
        createdByUserId: world.seed.userId,
        clientRequestId: randomUUID(),
        items: [],
      });
      expect(granted).not.toBeNull();
      await getDb()
        .update(orders)
        .set({ createdAt: new Date(now.getTime() - 2 * HOUR) })
        .where(eq(orders.consumerId, id));
      expect(await planReminders(now, [id])).toEqual({ planned: 0 });
      expect(await reminderRows(id)).toHaveLength(0);
    }, 60_000);

    it("opened 1 h ago and no coupon → no reminder", async () => {
      const consumer = await seedConsumer();
      consumerIds.push(consumer.id);
      await ensureWalletPass(consumer.id, "google");
      const now = eveningNow();
      await getDb()
        .update(consumerAccounts)
        .set({
          lastOpenedAt: new Date(now.getTime() - HOUR),
          createdAt: new Date(now.getTime() - 10 * 24 * HOUR),
        })
        .where(eq(consumerAccounts.id, consumer.id));
      expect(await planReminders(now, [consumer.id])).toEqual({ planned: 0 });
      // CONTROL: the same consumer, last open 3 days ago → inactive_48h.
      await getDb()
        .update(consumerAccounts)
        .set({ lastOpenedAt: new Date(now.getTime() - 72 * HOUR) })
        .where(eq(consumerAccounts.id, consumer.id));
      expect(await planReminders(now, [consumer.id])).toEqual({ planned: 1 });
      expect((await reminderRows(consumer.id))[0].body).toBe(
        REMINDER_BODIES.inactive_48h,
      );
    }, 60_000);

    it("a consumer no notice can reach (no pass, no Web Push) is not a candidate", async () => {
      const card = await newCouponCard(world);
      consumerIds.push(card.consumerId);
      expect(await planReminders(eveningNow(), [card.consumerId])).toEqual({
        planned: 0,
      });
    }, 60_000);

    it("the worker plans and drains the reminder in the same pass", async () => {
      const id = await couponConsumer();
      const fake = new FakePushChannel();
      const summary = await runPushWorker({
        channel: fake,
        webPushChannel: null,
        now: eveningNow(),
        consumerIds: [id],
      });
      expect(summary.planned).toBe(1);
      expect(summary.sent).toBe(1);
      const [row] = await reminderRows(id);
      expect(row.status).toBe("sent");
      expect(fake.calls).toEqual([
        expect.objectContaining({
          kind: "google",
          message: { header: "CheckPass", body: REMINDER_BODIES.coupon_new },
        }),
      ]);
    }, 60_000);

    it("markAccountOpened stamps last_opened_at, at most once every 15 minutes", async () => {
      const consumer = await seedConsumer();
      consumerIds.push(consumer.id);
      expect(await openedAt(consumer.id)).toBeNull();
      await markAccountOpened(consumer.id);
      const first = await openedAt(consumer.id);
      expect(first).not.toBeNull();
      await markAccountOpened(consumer.id);
      expect((await openedAt(consumer.id))?.getTime()).toBe(first?.getTime());
      // 16 minutes later (moved back in the row) it writes again.
      const old = new Date(first!.getTime() - 16 * 60 * 1000);
      await getDb()
        .update(consumerAccounts)
        .set({ lastOpenedAt: old })
        .where(eq(consumerAccounts.id, consumer.id));
      await markAccountOpened(consumer.id);
      expect((await openedAt(consumer.id))!.getTime()).toBeGreaterThan(
        old.getTime(),
      );
    }, 60_000);
  },
);
