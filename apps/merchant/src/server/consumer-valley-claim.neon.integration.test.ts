import { afterAll, describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { integrationEnabled } from "./counter-integration-support";
import {
  base,
  category,
  crossBusiness,
  crossCampaign,
  crossConsumer,
  dropCrossWorlds,
  north,
} from "./consumer-cross-support";
import {
  TUESDAY,
  at,
  claimValley,
  readValleyCoupons,
  setWindows,
  valleyBusiness,
  valleyCampaign,
} from "./consumer-valley-support";
import { claimCrossOffer } from "@mi-pasaporte/domain/server/consumer/cross-offers";
import { counterCouponState } from "./counter/coupon-state";
import { selectCoupon } from "@mi-pasaporte/domain/server/consumer/coupon-selection";

/**
 * Spec 0113 C2 (H4) — claiming a valley offer against a real base, INJECTED clock (Tuesday
 * 2026-10-06, Buenos Aires, UTC-3). Every state is READ BY SQL. ORACULO DE M7: the coupon
 * lives until the window closes TODAY — `valid_until` is 20:00Z for a 15–17 window, and the
 * counter's read (`counterCouponState`, the resolve's `couponState` since spec 0148) no
 * longer shows the chosen coupon at 17:05.
 */

afterAll(dropCrossWorlds, 180_000);

const WINDOW = { weekday: TUESDAY, startHour: 15, endHour: 17 };

async function world(tag: string, index: number) {
  const cat = category(tag);
  const here = base(index);
  const x = await valleyBusiness(`Valle ${tag}`, cat("bar"), north(here, 300));
  const campaignId = await valleyCampaign(x);
  await setWindows(x.seed.locationId, [WINDOW]);
  return { x, here, campaignId, consumer: await crossConsumer() };
}

describe.skipIf(!integrationEnabled || !campaignKindEnabled("valley"))(
  "valley offers — C2 claim",
  () => {
    it("ORACULO DE M7 — claimed at 15:10 in a 15–17 window: valid until 20:00Z; the counter drops it at 17:05", async () => {
      const { x, here, campaignId, consumer } = await world("v-m7", 51);
      const now = at("15:10");
      const answer = await claimValley(
        consumer.id,
        campaignId,
        x.seed.locationId,
        here,
        now,
      );
      expect(answer.status).toBe(201);
      const rows = await readValleyCoupons(campaignId);
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row).toMatchObject({
        consumerId: consumer.id,
        membershipId: null,
        valleyLocationId: x.seed.locationId,
        kind: "custom",
        label: "2x1 en cerveza",
      });
      expect(row.crossClaimedAt!.toISOString()).toBe(now.toISOString());
      expect(row.validFrom.toISOString()).toBe(now.toISOString());
      // `soft`: a wrong `valid_until` must not stop the case before the counter's read below,
      // which is the other half of the oracle (the coupon is gone at 17:05).
      expect
        .soft(row.validUntil.toISOString())
        .toBe("2026-10-06T20:00:00.000Z");
      expect(answer.status === 201 && answer.coupon).toMatchObject({
        id: row.id,
        kind: "custom",
        label: "2x1 en cerveza",
        status: "valid",
      });

      // Spec 0148: the consumer chooses it (16:30); the counter shows the choice until the
      // window closes, and at 17:05 the stale choice paints nothing.
      const counter = (hhmm: string) =>
        counterCouponState(x.seed.business.id, consumer.id, at(hhmm));
      expect(
        await selectCoupon(consumer.id, row.id, at("16:30")),
      ).toMatchObject({ status: 200 });
      expect(await counter("16:30")).toMatchObject({
        status: "selected",
        coupon: { couponId: row.id },
      });
      expect(await counter("17:05")).toEqual({ status: "none" });
    }, 180_000);

    it("idempotent: the same claim again is 200 with the same coupon", async () => {
      const { x, here, campaignId, consumer } = await world("v-idem", 52);
      const first = await claimValley(
        consumer.id,
        campaignId,
        x.seed.locationId,
        here,
        at("15:10"),
      );
      const again = await claimValley(
        consumer.id,
        campaignId,
        x.seed.locationId,
        null,
        at("15:40"),
      );
      expect([first.status, again.status]).toEqual([201, 200]);
      expect(
        first.status !== 404 && first.status !== 400 && first.coupon.id,
      ).toBe(again.status !== 404 && again.status !== 400 && again.coupon.id);
      expect(await readValleyCoupons(campaignId)).toHaveLength(1);
    }, 180_000);

    it("404: the window is closed, the location is another business's, no position", async () => {
      const { x, here, campaignId, consumer } = await world("v-404", 53);
      const other = await crossBusiness(
        "Ajeno v404",
        category("v-404b")("gym"),
        north(here, 400),
      );
      expect(
        (
          await claimValley(
            consumer.id,
            campaignId,
            x.seed.locationId,
            here,
            at("17:00"),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await claimValley(
            consumer.id,
            campaignId,
            other.seed.locationId,
            here,
            at("15:10"),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await claimValley(
            consumer.id,
            campaignId,
            x.seed.locationId,
            null,
            at("15:10"),
          )
        ).status,
      ).toBe(404);
      expect(await readValleyCoupons(campaignId)).toEqual([]);
    }, 180_000);

    it("400 fields.locationId: a valley offer without it, a cross offer with it", async () => {
      const { here, campaignId, consumer } = await world("v-400", 54);
      expect(
        await claimCrossOffer(consumer.id, campaignId, here, at("15:10")),
      ).toEqual({
        status: 400,
        fields: { locationId: expect.any(String) },
      });
      const cross = await crossBusiness(
        "Cruz v400",
        category("v-400c")("gym"),
        north(here, 500),
      );
      const crossId = await crossCampaign(cross);
      expect(
        await claimValley(
          consumer.id,
          crossId,
          cross.seed.locationId,
          here,
          at("15:10"),
        ),
      ).toEqual({ status: 400, fields: { locationId: expect.any(String) } });
      expect(await readValleyCoupons(campaignId)).toEqual([]);
      // The cross claim itself is untouched.
      expect((await claimCrossOffer(consumer.id, crossId, here)).status).toBe(
        201,
      );
    }, 180_000);

    it("the monthly cap: with cap 1, a second consumer is 404", async () => {
      const cat = category("v-cap");
      const here = base(55);
      const x = await valleyBusiness("Valle cap", cat("bar"), north(here, 300));
      const campaignId = await valleyCampaign(x, { monthlyCap: 1 });
      await setWindows(x.seed.locationId, [WINDOW]);
      const [a, b] = [await crossConsumer(), await crossConsumer()];
      expect(
        (
          await claimValley(
            a.id,
            campaignId,
            x.seed.locationId,
            here,
            at("15:10"),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await claimValley(
            b.id,
            campaignId,
            x.seed.locationId,
            here,
            at("15:20"),
          )
        ).status,
      ).toBe(404);
    }, 180_000);
  },
);
