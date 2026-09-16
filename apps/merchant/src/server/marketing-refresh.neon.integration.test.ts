import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import {
  NEAR,
  seedCampaign,
  seedLocation,
  seedMembership,
} from "./marketing-integration-support";
import {
  dropCampaigns,
  readAccount,
  readPlacement,
} from "./marketing-read-support";
import { enqueue, queueRow } from "./wallet-push-integration-support";
import { runMarketingTick } from "./marketing/tick";
import { getDb } from "./db";
import { walletPushQueue } from "./schema";
import { ensureWalletPass } from "./wallet/core";
import { listUpdatedSerials, registerDevice } from "./wallet/passkit";
import { FakePushChannel } from "./wallet/push-channel";
import { FakeWebPushChannel } from "./push/webpush-channel";
import { runPushWorker } from "./wallet/push-worker";

/**
 * The `pass_refresh` lane end to end (spec 0065 phase A5): the tick is the first
 * producer of those rows that has ever existed — phase A3 built the lane with nothing
 * feeding it. What is asserted here is what no unit can see: that the row the tick
 * writes drains SILENTLY (an APNs wake-up and a Google `PATCH`, never an `addMessage`
 * and never a Web Push), that it leaves the consumer's notice and push budget alone,
 * and that a second refresh does not pile up behind the first.
 */

/** Own advisory namespace: the suites share one database and a single key would
 * make them answer `tick_in_flight` to each other. The skip itself is asserted with the
 * production default, in `marketing-placement`. */
const NS = "marketing_tick_test_refresh";

const DAY = 86_400_000;
const NOW = new Date("2026-09-16T12:00:00.000Z");

async function refreshRows(consumerId: string) {
  return await getDb()
    .select()
    .from(walletPushQueue)
    .where(
      and(
        eq(walletPushQueue.consumerId, consumerId),
        eq(walletPushQueue.class, "pass_refresh"),
      ),
    );
}

describe.skipIf(!integrationEnabled)("marketing pass_refresh", () => {
  let seed: Seed;
  let consumerId: string;
  let doorId: string;
  let serialNumber: string;
  let deviceLibraryId: string;

  beforeAll(async () => {
    seed = await seedBusiness({
      name: `Marketing refresh ${Date.now()}`,
      kind: "stamps",
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    doorId = await seedLocation({ businessId: seed.business.id, ...NEAR });
    await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [doorId],
    });
    const consumer = await seedConsumer();
    consumerId = consumer.id;
    await seedMembership({
      consumerId,
      programId: seed.programId,
      businessId: seed.business.id,
      enrolledAt: new Date(NOW.getTime() - 400 * DAY),
    });
    const apple = await ensureWalletPass(consumerId, "apple");
    await ensureWalletPass(consumerId, "google");
    serialNumber = apple.serialNumber;
    deviceLibraryId = `dev-${randomUUID()}`;
    await registerDevice({
      passId: apple.id,
      deviceLibraryId,
      pushToken: "apns-refresh-token",
    });
    await runMarketingTick({
      now: NOW,
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: [consumerId],
    });
  }, 180_000);

  afterAll(async () => {
    if (!integrationEnabled) return;
    await getDb()
      .delete(walletPushQueue)
      .where(eq(walletPushQueue.consumerId, consumerId));
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }, 120_000);

  it("the tick is the producer: one pending refresh and the door in the pass", async () => {
    expect(await readPlacement(consumerId)).toHaveLength(1);
    const rows = await refreshRows(consumerId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", title: "", body: "" });
  });

  it("drains SILENTLY: APNs wake-up + Google PATCH, no addMessage, no Web Push", async () => {
    const channel = new FakePushChannel();
    const webPush = new FakeWebPushChannel();
    const summary = await runPushWorker({
      channel,
      webPushChannel: webPush,
      now: new Date(NOW.getTime() + 60_000),
      consumerIds: [consumerId],
    });
    expect(summary.sent).toBe(1);
    expect(channel.calls.map((call) => call.kind).sort()).toEqual([
      "apple",
      "google-patch",
    ]);
    // The distinction the fake exists for: `addMessage` would ring the phone.
    expect(channel.calls.some((call) => call.kind === "google")).toBe(false);
    expect(webPush.calls).toEqual([]);
    const patch = channel.calls.find((call) => call.kind === "google-patch");
    expect(patch).toMatchObject({ serialNumber: expect.any(String) });
    // The body is read AT DELIVERY from `pass_placement` (phase A4), so it carries the
    // door the tick placed instead of a photo frozen when the row was queued.
    expect(
      JSON.stringify((patch as { patch: Record<string, unknown> }).patch),
    ).toContain("merchantLocations");
  }, 120_000);

  it("spends neither the notice nor the push budget", async () => {
    const account = await readAccount(consumerId);
    expect(account.latestMessage).toBeNull();
    expect(account.lastPushAt).toBeNull();
    // `message_updated_at` IS the tag the tick set: that is what Apple polls.
    expect(account.messageUpdatedAt).toEqual(NOW);
  });

  it("answers `passesUpdatedSince` with the pass whose placement changed", async () => {
    const listed = await listUpdatedSerials({ deviceLibraryId });
    expect(listed?.serialNumbers).toContain(serialNumber);
    const after = await listUpdatedSerials({
      deviceLibraryId,
      passesUpdatedSince: String(NOW.getTime()),
    });
    expect(after).toBeNull();
  }, 60_000);

  it("coalesces: a pending refresh is never duplicated by another run", async () => {
    // Force a real change of the set so the planner asks for a refresh again.
    await getDb()
      .delete(walletPushQueue)
      .where(eq(walletPushQueue.consumerId, consumerId));
    await enqueue(consumerId, "pass_refresh", { status: "pending" });
    const before = await refreshRows(consumerId);
    expect(before).toHaveLength(1);
    await runMarketingTick({
      now: new Date(NOW.getTime() + 2 * 60_000),
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: [consumerId],
    });
    expect(await refreshRows(consumerId)).toHaveLength(1);
  }, 120_000);

  it("two live refreshes coexist: the retry state is representable, not fatal", async () => {
    // The state a partial unique index over `(consumer, pass_refresh, pending)` would
    // have made FATAL (spec 0065): the worker returns a failed row to `pending` in the
    // SAME update that bumps `attempts`, so with such an index that update would fail,
    // the row would stay wedged in `sending` and `claimRow` would re-claim it on every
    // run, eating the budget. There is no unique — this pins that there never is one.
    //
    // DECLARED, and MEASURED rather than assumed: the «back to pending» branch of
    // `wallet/push.ts` only fires on an exception OUTSIDE the per-transport error
    // collection. A real APNs 403 is recorded on the row and the row still closes
    // `sent` (measured here first, with a `FakePushChannel` failing the token). So what
    // this asserts is the STATE that branch produces — two live rows for one consumer —
    // and not the branch, which no reachable input of this suite triggers.
    await getDb()
      .delete(walletPushQueue)
      .where(eq(walletPushQueue.consumerId, consumerId));
    const retried = await enqueue(consumerId, "pass_refresh", {
      status: "pending",
    });
    await enqueue(consumerId, "pass_refresh", { status: "sending" });
    expect(await refreshRows(consumerId)).toHaveLength(2);

    // And the tick, seeing one alive, adds no third.
    await runMarketingTick({
      now: new Date(NOW.getTime() + 3 * 60_000),
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: [consumerId],
    });
    expect(await refreshRows(consumerId)).toHaveLength(2);

    const channel = new FakePushChannel();
    await runPushWorker({
      channel,
      webPushChannel: null,
      now: new Date(NOW.getTime() + 4 * 60_000),
      consumerIds: [consumerId],
    });
    const row = await queueRow(retried);
    expect(row.status).toBe("sent");
    expect(row.lastError).toBeNull();
  }, 120_000);
});
