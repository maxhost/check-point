import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { dropCrossWorlds } from "./consumer-cross-support";
import {
  MINUTE,
  businessName,
  couponsOf,
  decisionsOf,
  enrolled,
  orderAt,
  pushesOf,
  queueOf,
  saleWorld,
} from "./cross-sale-support";
import { seedWebPush } from "./marketing-push-support";
import { FakePushChannel } from "./wallet/push-channel";
import { runPushWorker } from "./wallet/push-worker";
import { FakeWebPushChannel } from "@mi-pasaporte/domain/server/push/webpush-channel";
import { decideCrossSale } from "@mi-pasaporte/domain/server/marketing/cross-sale";
import { recordPushClick } from "@mi-pasaporte/domain/server/marketing/push-delivery";

/**
 * Spec 0143 §5 — the «regalo misterio» in the worker, against a real base, through the REAL
 * `runPushWorker` with fake transports. The consumer only has Web Push, so the click id is
 * observable in the payload. The clock is 22:00 in B's zone (America/Guayaquil, window
 * 9–21): a campaign push of `campaign_push` would be rescheduled; this one goes (owner: «No,
 * sale con la compra»). ORACULO DE M6: without the cross gate the row would STILL be sent
 * (it falls to `gateWelcomeReminder` → send with no click id), so the oracle is the click id.
 */

afterAll(dropCrossWorlds, 180_000);

const NIGHT = new Date("2026-09-17T03:00:00.000Z"); // 22:00 local
const DECIDED = new Date(NIGHT.getTime() - 10 * MINUTE);

describe.skipIf(!integrationEnabled)(
  "cross sale — the push in the worker",
  () => {
    it("ORACULO DE M6 — sent at 22:00 local with clickId = the decision's id; no `campaign_push`, no extra coupon; the click writes `clicked_at`", async () => {
      const w = await saleWorld("push");
      const who = await enrolled(w.a);
      const endpoint = await seedWebPush(who.consumerId);
      const orderId = await orderAt(
        w.a,
        who,
        new Date(DECIDED.getTime() - MINUTE),
      );
      expect(
        await decideCrossSale(orderId, { now: DECIDED, random: () => 0 }),
      ).toBe("issued");
      const [decision] = await decisionsOf(who.consumerId);

      const web = new FakeWebPushChannel();
      await runPushWorker({
        channel: new FakePushChannel(),
        webPushChannel: web,
        now: NIGHT,
        consumerIds: [who.consumerId],
      });

      const rows = await queueOf(who.consumerId);
      expect(rows).toEqual([
        expect.objectContaining({ id: decision.queueId, status: "sent" }),
      ]);
      expect(web.calls).toEqual([
        {
          endpoint,
          payload: {
            title: "🎁 Tenés un regalo",
            body: `Por tu compra en ${await businessName(w.a)}. Abrí la app y descubrí qué es.`,
            url: "/wallet",
            clickId: decision.id,
          },
        },
      ]);
      // `recordSent(clickId)` ran with a decision id: it touches no `campaign_push` and issues
      // no second coupon.
      expect(await pushesOf(who.consumerId)).toEqual([]);
      expect(await couponsOf(who.consumerId)).toEqual([
        expect.objectContaining({ id: decision.couponId }),
      ]);

      // The click (the consumer's route calls `recordPushClick`): the first one wins.
      await recordPushClick(decision.id);
      const [clicked] = await decisionsOf(who.consumerId);
      expect(clicked.clickedAt).toBeInstanceOf(Date);
      await recordPushClick(decision.id);
      expect((await decisionsOf(who.consumerId))[0].clickedAt).toEqual(
        clicked.clickedAt,
      );
    }, 120_000);
  },
);
