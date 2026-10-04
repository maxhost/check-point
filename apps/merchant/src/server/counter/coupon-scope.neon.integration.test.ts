import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../counter-integration-support";
import {
  type CycleWorld,
  backdate,
  choose,
  dropCycleWorld,
  redemptionsOf,
  scannedCustomer,
  seedCycleWorld,
  sell,
  validateBody,
  welcomeCoupon,
} from "./coupon-cycle-support";
import { validateCoupon } from "./coupon-validate";
import { removeCoupon } from "./coupon-remove";
import { listTodaysAccreditations } from "./history";

/**
 * Spec 0148 — the scopes the review found WITHOUT an oracle (every case here was measured
 * red against its mutation by the independent reviewer, and green on the clean tree):
 *  - ORACULO DE R1: `lockCounterCoupon` scopes the coupon to THIS consumer. A VALIDATED
 *    coupon skips the choice guard in the sale, so that scope is the only thing between
 *    customer A's sale and customer B's coupon.
 *  - ORACULO DE R2: a validated row of ANOTHER day is consumed (ADR 0119 §11), so the sale
 *    of today cannot attach it.
 *  - ORACULO DE R3: the day history only lists the coupons of THIS business.
 */

let world: CycleWorld;

beforeAll(async () => {
  world = await seedCycleWorld("Cupon alcance");
}, 120_000);

afterAll(async () => {
  if (world) await dropCycleWorld(world);
}, 120_000);

describe.skipIf(!integrationEnabled)("counter coupon scopes", () => {
  it("customer A cannot sell with, nor remove, customer B's VALIDATED coupon", async () => {
    const a = await scannedCustomer(world);
    const b = await scannedCustomer(world);
    const couponB = await welcomeCoupon(world, b, {
      kind: "free_product",
      label: "Gratis B",
    });
    await choose(b, couponB);
    await validateCoupon(
      world.seed.business,
      world.seed.userId,
      validateBody(world, b, couponB),
    );
    await expect(
      sell(world, a, { mode: "quick", total: "5.00" }, { couponId: couponB }),
    ).rejects.toMatchObject({ status: 404, code: "unknown_coupon" });
    await expect(
      removeCoupon(world.seed.business, {
        membershipId: a.membershipId,
        couponId: couponB,
      }),
    ).rejects.toMatchObject({ status: 404, code: "unknown_coupon" });
    const rows = await redemptionsOf(couponB);
    expect(rows).toHaveLength(1);
    expect(rows[0].orderId).toBeNull();
  }, 180_000);

  it("a coupon validated YESTERDAY is consumed: today's sale cannot attach it", async () => {
    const c = await scannedCustomer(world);
    const coupon = await welcomeCoupon(world, c, {
      kind: "free_product",
      label: "Gratis ayer",
    });
    await choose(c, coupon);
    await validateCoupon(
      world.seed.business,
      world.seed.userId,
      validateBody(world, c, coupon),
    );
    const [row] = await redemptionsOf(coupon);
    await backdate(row.id, new Date(Date.now() - 86_400_000));
    await expect(
      sell(world, c, { mode: "quick", total: "5.00" }, { couponId: coupon }),
    ).rejects.toMatchObject({ status: 409, code: "coupon_not_selected" });
    const [after] = await redemptionsOf(coupon);
    expect(after.orderId).toBeNull();
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
      await validateCoupon(
        other.seed.business,
        other.seed.userId,
        validateBody(other, c, coupon),
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
