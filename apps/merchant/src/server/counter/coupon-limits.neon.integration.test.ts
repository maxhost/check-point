import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedReward,
  setBalance,
} from "../counter-integration-support";
import {
  type CycleWorld,
  backdate,
  choose,
  dropCycleWorld,
  redemptionsOf,
  scannedCustomer,
  secondCoupon,
  seedCycleWorld,
  sell,
  welcomeCoupon,
} from "./coupon-cycle-support";
import { getCouponState } from "./coupon-state";
import { removeCoupon } from "./coupon-remove";
import { redeemReward } from "./redeem";

/**
 * Spec 0148 — ONE COUPON PER CUSTOMER + BUSINESS + LOCAL DAY (ADR 0119 §14-§15) and the
 * counter's isolation, against Neon. The business lives in `America/Guayaquil` (UTC-5, no
 * DST): the local day starts at 05:00Z. Spec 0153: a coupon is redeemed by the SALE.
 */

const HOUR = 3_600_000;
const OFFSET = 5 * HOUR; // Guayaquil = UTC-5

/** 00:00 local of the local day of `at`, as an instant. */
function localMidnight(at: Date): Date {
  const local = new Date(at.getTime() - OFFSET);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) +
      OFFSET,
  );
}

let world: CycleWorld;

beforeAll(async () => {
  world = await seedCycleWorld("Cupon limite");
}, 120_000);

afterAll(async () => {
  if (world) await dropCycleWorld(world);
}, 120_000);

const free = (label: string) => ({ kind: "free_product" as const, label });

describe.skipIf(!integrationEnabled)("the daily limit (spec 0148)", () => {
  it("ORACULO DE M2 (0148) / M3 (0153) — a SECOND, different coupon of the same customer the same day: painted red, and the sale is 409 coupon_daily_limit", async () => {
    const customer = await scannedCustomer(world);
    const a = await welcomeCoupon(world, customer, free("Postre gratis"));
    const b = await secondCoupon(world, customer);
    await choose(customer, a);
    await sell(
      world,
      customer,
      { mode: "quick", total: "5.00" },
      { couponId: a },
    );

    await choose(customer, b);
    const { couponState } = await getCouponState(
      world.seed.business,
      customer.membershipId,
    );
    expect(couponState).toMatchObject({
      status: "selected",
      coupon: { couponId: b },
      verdict: { valid: false, code: "coupon_daily_limit" },
    });
    await expect(
      sell(world, customer, { mode: "quick", total: "5.00" }, { couponId: b }),
    ).rejects.toMatchObject({ status: 409, code: "coupon_daily_limit" });
    expect(await redemptionsOf(b)).toEqual([]);
  }, 180_000);

  it("ORACULO DE M3 — a coupon at 23:30 LOCAL of yesterday (04:30Z of today) does not spend today's", async () => {
    const real = new Date();
    // `now` has to share its UTC date with 04:30Z of its local day (so a UTC day would
    // block it): before 19:00 local. After that hour, the next local day at 06:00.
    const localHour = new Date(real.getTime() - OFFSET).getUTCHours();
    const now =
      localHour < 19
        ? real
        : new Date(localMidnight(real).getTime() + 24 * HOUR + 6 * HOUR);
    const lastNight = new Date(localMidnight(now).getTime() - 30 * 60_000);
    expect(lastNight.toISOString().slice(0, 10)).toBe(
      now.toISOString().slice(0, 10),
    );

    const customer = await scannedCustomer(world);
    const a = await welcomeCoupon(world, customer, free("Postre gratis"));
    const b = await secondCoupon(world, customer);
    await choose(customer, a);
    await sell(
      world,
      customer,
      { mode: "quick", total: "5.00" },
      { couponId: a },
    );
    const [row] = await redemptionsOf(a);
    await backdate(row.id, lastNight);

    await choose(customer, b);
    await expect(
      sell(
        world,
        customer,
        { mode: "quick", total: "5.00" },
        { couponId: b },
        randomUUID(),
        now,
      ),
    ).resolves.toMatchObject({ order: { coupon: { label: "Café gratis" } } });
  }, 180_000);

  it("redeeming a REWARD of the program does not count as the visit's coupon (ADR 0119 §15)", async () => {
    const customer = await scannedCustomer(world);
    const rewardId = await seedReward({
      programId: world.seed.programId,
      businessId: world.seed.business.id,
      pointsCost: 10,
    });
    await setBalance(customer.membershipId, { points: 50 });
    await redeemReward(world.seed.business, world.seed.userId, {
      clientRequestId: randomUUID(),
      membershipId: customer.membershipId,
      rewardId,
      locationId: world.seed.locationId,
    });
    const a = await welcomeCoupon(world, customer, free("Postre gratis"));
    await choose(customer, a);
    await expect(
      sell(world, customer, { mode: "quick", total: "5.00" }, { couponId: a }),
    ).resolves.toMatchObject({ order: { coupon: { label: "Postre gratis" } } });
  }, 180_000);
});

describe.skipIf(!integrationEnabled)(
  "the counter's isolation (spec 0148)",
  () => {
    it("a membership of ANOTHER business is a 404 in coupon-state and remove", async () => {
      const other = await seedCycleWorld("Cupon ajeno");
      try {
        const stranger = await scannedCustomer(other);
        const couponId = await welcomeCoupon(other, stranger, free("Ajeno"));
        await choose(stranger, couponId);
        await expect(
          getCouponState(world.seed.business, stranger.membershipId),
        ).rejects.toMatchObject({ status: 404, code: "not_found" });
        await expect(
          removeCoupon(world.seed.business, {
            membershipId: stranger.membershipId,
            couponId,
          }),
        ).rejects.toMatchObject({ status: 404, code: "not_found" });
        expect(await redemptionsOf(couponId)).toEqual([]);
      } finally {
        await dropCycleWorld(other);
      }
    }, 180_000);
  },
);
