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
} from "@mi-pasaporte/db/schema";
import { ensureWalletPass } from "@mi-pasaporte/domain/server/wallet/core";
import { registerDevice } from "@mi-pasaporte/domain/server/wallet/passkit";
import { FakePushChannel } from "./wallet/push-channel";
import { FakeWebPushChannel } from "@mi-pasaporte/domain/server/push/webpush-channel";
import { deliverRow } from "./wallet/push";

/**
 * Spec 0139 / ADR 0116, against real rows: a counter notice without a Web Push
 * subscription has NO channel (it closes `suppressed`/`no_channel`, writes nothing and does
 * not count in the 24 h budget), only a `reminder` writes the pass's «Última novedad», and
 * the reminder keeps its route (wallet when reachable, else Web Push). Each delivery goes
 * through `deliverRow` (claim + `deliverClaimed`), without the drain's cooldown planner.
 */

const HOUR = 60 * 60 * 1000;
const consumerIds: string[] = [];

/** A consumer whose Apple pass HAS a registered device: the wallet is reachable. */
async function consumerWithApple(pushToken: string) {
  const consumer = await seedConsumer();
  consumerIds.push(consumer.id);
  const apple = await ensureWalletPass(consumer.id, "apple");
  await registerDevice({
    passId: apple.id,
    deviceLibraryId: `dev-${randomUUID()}`,
    pushToken,
  });
  return consumer;
}

async function account(consumerId: string) {
  const [row] = await getDb()
    .select()
    .from(consumerAccounts)
    .where(eq(consumerAccounts.id, consumerId));
  return row;
}

async function deliver(id: string, now = new Date()) {
  const wallet = new FakePushChannel();
  const web = new FakeWebPushChannel();
  expect(
    await deliverRow(id, { channel: wallet, webPushChannel: web, now }),
  ).toBe(true);
  return { wallet, web };
}

describe.skipIf(!integrationEnabled)(
  "notice channels and the pass's «Última novedad» against Neon (spec 0139)",
  () => {
    afterAll(async () => {
      const db = getDb();
      for (const id of consumerIds) {
        await db
          .delete(walletPushQueue)
          .where(eq(walletPushQueue.consumerId, id));
        await db.delete(walletPasses).where(eq(walletPasses.consumerId, id));
        await db.delete(consumerAccounts).where(eq(consumerAccounts.id, id));
      }
    }, 30_000);

    // ORACULO DE M2: the assertion is DIRECT on `status` AND `last_error` — the budget
    // also closes `suppressed`, with `budget_24h`.
    it("counter notice with a reachable pass but NO subscription → no call, suppressed/no_channel, account untouched", async () => {
      const consumer = await consumerWithApple("nochan-apns");
      const before = await account(consumer.id);
      const id = await enqueue(consumer.id, "transactional");

      const { wallet, web } = await deliver(id);

      const row = await queueRow(id);
      expect(row.status).toBe("suppressed");
      expect(row.lastError).toBe("no_channel");
      expect(row.sentAt).toBeNull();
      expect(wallet.calls).toEqual([]);
      expect(web.calls).toEqual([]);
      const after = await account(consumer.id);
      expect(after.latestMessage).toBe(before.latestMessage);
      expect(after.messageUpdatedAt?.getTime()).toBe(
        before.messageUpdatedAt?.getTime(),
      );
      expect(after.lastPushAt?.getTime()).toBe(before.lastPushAt?.getTime());
    }, 30_000);

    // ORACULO DE M3. Two `reminder`s already rang (not counter notices: the counter cap of
    // 2 would suppress a 3rd counter notice anyway). A counter notice WITHOUT a channel must
    // not take the 3rd slot, so the reminder that follows still rings.
    it("a counter notice without a channel does not count in the 24 h budget", async () => {
      const consumer = await consumerWithApple("budget-apns");
      const now = new Date();
      for (const h of [1, 2])
        await getDb()
          .insert(walletPushQueue)
          .values({
            consumerId: consumer.id,
            class: "reminder",
            title: "CheckPass Club",
            body: "antes",
            status: "sent",
            notBefore: new Date(now.getTime() - (h + 1) * HOUR),
            sentAt: new Date(now.getTime() - h * HOUR),
          });

      const counterId = await enqueue(consumer.id, "transactional");
      await deliver(counterId, now);
      expect((await queueRow(counterId)).lastError).toBe("no_channel");

      const reminderId = await enqueue(consumer.id, "reminder", {
        title: "CheckPass Club",
        body: "Te extrañamos",
      });
      const { wallet } = await deliver(reminderId, new Date(now.getTime() + 1));
      const reminder = await queueRow(reminderId);
      expect(reminder.lastError).toBeNull();
      expect(reminder.status).toBe("sent");
      expect(
        wallet.calls.some(
          (c) => c.kind === "apple" && c.pushToken === "budget-apns",
        ),
      ).toBe(true);
    }, 30_000);

    // ORACULO DE M4 (and the positive half: a reminder DOES write it).
    it("a delivered counter notice leaves «Última novedad» alone; a delivered reminder writes it", async () => {
      const consumer = await consumerWithApple("latest-apns");
      await subscribe(consumer.id);
      const before = await account(consumer.id);

      const counterId = await enqueue(consumer.id, "transactional", {
        body: "+1 sello",
      });
      const counter = await deliver(counterId);
      expect((await queueRow(counterId)).status).toBe("sent");
      expect(counter.web.calls).toHaveLength(1);
      expect((await account(consumer.id)).latestMessage).toBe(
        before.latestMessage,
      );

      const reminderId = await enqueue(consumer.id, "reminder", {
        title: "CheckPass Club",
        body: "Te extrañamos",
      });
      const at = new Date();
      await deliver(reminderId, at);
      expect((await queueRow(reminderId)).status).toBe("sent");
      const after = await account(consumer.id);
      expect(after.latestMessage).toBe("CheckPass Club: Te extrañamos");
      expect(after.messageUpdatedAt?.getTime()).toBe(at.getTime());
    }, 30_000);

    // ORACULO DE M5: the reminder keeps its route — and a subscription does not divert it.
    it("reminder: reachable pass → wallet only (even with a subscription); no pass → Web Push", async () => {
      const withPass = await consumerWithApple("reminder-apns");
      await subscribe(withPass.id);
      const viaWallet = await deliver(
        await enqueue(withPass.id, "reminder", { title: "CheckPass Club" }),
      );
      expect(viaWallet.wallet.calls.map((c) => c.kind)).toEqual(["apple"]);
      expect(viaWallet.web.calls).toEqual([]);

      const noPass = await seedConsumer();
      consumerIds.push(noPass.id);
      const endpoint = await subscribe(noPass.id);
      const viaWeb = await deliver(
        await enqueue(noPass.id, "reminder", { title: "CheckPass Club" }),
      );
      expect(viaWeb.wallet.calls).toEqual([]);
      expect(viaWeb.web.calls.map((c) => c.endpoint)).toEqual([endpoint]);
    }, 30_000);
  },
);
