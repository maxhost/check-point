import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../counter-integration-support";
import {
  type CycleWorld,
  choose,
  dropCycleWorld,
  redemptionsOf,
  scannedCustomer,
  seedCycleWorld,
  sell,
  welcomeCoupon,
} from "./coupon-cycle-support";
import { removeCoupon } from "./coupon-remove";
import { listTodaysAccreditations } from "./history";

/**
 * Spec 0148 — the scopes the review found WITHOUT an oracle (every case here was measured
 * red against its mutation by the independent reviewer, and green on the clean tree):
 *  - ORACULO DE R1: `lockCounterCoupon` scopes the coupon to THIS consumer: customer A's
 *    sale and «Quitar» cannot reach customer B's chosen coupon (404, never a 403).
 *  - ORACULO DE R3: the day history only lists the coupons of THIS business.
 * (R2 — a validated row of another day — went with «validate», spec 0153.)
 */

let world: CycleWorld;

beforeAll(async () => {
  world = await seedCycleWorld("Cupon alcance");
}, 120_000);

afterAll(async () => {
  if (world) await dropCycleWorld(world);
}, 120_000);

describe.skipIf(!integrationEnabled)("counter coupon scopes", () => {
  it("customer A cannot sell with, nor remove, customer B's CHOSEN coupon", async () => {
    const a = await scannedCustomer(world);
    const b = await scannedCustomer(world);
    const couponB = await welcomeCoupon(world, b, {
      kind: "free_product",
      label: "Gratis B",
    });
    await choose(b, couponB);
    await expect(
      sell(world, a, { mode: "quick", total: "5.00" }, { couponId: couponB }),
    ).rejects.toMatchObject({ status: 404, code: "unknown_coupon" });
    await expect(
      removeCoupon(world.seed.business, {
        membershipId: a.membershipId,
        couponId: couponB,
      }),
    ).rejects.toMatchObject({ status: 404, code: "unknown_coupon" });
    expect(await redemptionsOf(couponB)).toEqual([]);
  }, 180_000);

  it("the day history does not list another business's coupons", async () => {
    const other = await seedCycleWorld("Cupon ajeno");
    try {
      const c = await scannedCustomer(other);
      const coupon = await welcomeCoupon(other, c, {
        kind: "free_product",
        label: "Cupon de otro comercio",
      });
      await choose(c, coupon);
      await sell(
        other,
        c,
        { mode: "quick", total: "5.00" },
        { couponId: coupon },
      );
      const history = await listTodaysAccreditations(
        world.seed.business.id,
        "America/Guayaquil",
        new Date(),
      );
      expect(history.map((e) => e.rewardLabel)).not.toContain(
        "Cupon de otro comercio",
      );
    } finally {
      await dropCycleWorld(other);
    }
  }, 180_000);
});
