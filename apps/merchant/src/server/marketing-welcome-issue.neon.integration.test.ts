import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { counterCouponState } from "./counter/coupon-state";
import { selectCoupon } from "@mi-pasaporte/domain/server/consumer/coupon-selection";
import { unregisterDevice } from "@mi-pasaporte/domain/server/wallet/passkit";
import { issueWelcomeGifts } from "@mi-pasaporte/domain/server/marketing/welcome-issue";
import { runMarketingTick } from "./marketing/tick";
import {
  DAY,
  dropWelcomeWorlds,
  installOn,
  readWelcomeCoupons,
  readWelcomeDevices,
  welcomeConsumer,
  welcomeWorld,
} from "./marketing-welcome-support";

/**
 * THE DELIVERY OF THE WELCOME GIFT (spec 0107 §3, E2) against a real database, in the
 * business's zone `America/Guayaquil` (UTC−5). Each case is the oracle of one mutation of
 * the spec's table (M1–M6) and every state is read BY SQL.
 */

afterAll(dropWelcomeWorlds, 120_000);

const ON = new Date("2026-09-01T12:00:00.000Z");
/** 2026-10-01 21:00 local = 2026-10-02 02:00Z: already «tomorrow» in UTC. */
const EVENING = new Date("2026-10-02T02:00:00.000Z");

describe.skipIf(!integrationEnabled)("welcome gift — delivery (E2)", () => {
  it("ORACULO DE M1: next_day is the next LOCAL midnight; the counter hides it today and shows it tomorrow", async () => {
    const world = await welcomeWorld("Welcome M1", { activatedAt: ON });
    const person = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 60_000),
    );
    await installOn(person, "dev-m1");

    expect(
      await issueWelcomeGifts(person.consumerId, EVENING, {
        deviceLibraryId: "dev-m1",
      }),
    ).toBe(1);
    const [coupon] = await readWelcomeCoupons(world.seed.business.id);
    expect(coupon.membershipId).toBe(person.membershipId);
    expect(coupon.validFrom.toISOString()).toBe("2026-10-02T05:00:00.000Z");
    expect(coupon.validUntil.toISOString()).toBe(
      new Date(EVENING.getTime() + 15 * DAY).toISOString(),
    );
    const business = world.seed.business.id;
    // Spec 0148: the counter shows the coupon the consumer CHOSE, and a coupon that does not
    // run yet can be neither chosen nor counted.
    const tonight = new Date("2026-10-02T02:30:00.000Z");
    const tomorrow = new Date("2026-10-02T15:00:00.000Z");
    // Same night (21:30 local): not yet.
    expect(
      await counterCouponState(business, person.consumerId, tonight),
    ).toEqual({ status: "none" });
    expect(
      await selectCoupon(person.consumerId, coupon.id, tonight),
    ).toMatchObject({ status: 409, code: "coupon_not_selectable" });
    // Next day 10:00 local (15:00Z): there it is.
    expect(
      await counterCouponState(business, person.consumerId, tomorrow),
    ).toEqual({ status: "hint", count: 1 });
    expect(
      await selectCoupon(person.consumerId, coupon.id, tomorrow),
    ).toMatchObject({ status: 200 });
    expect(
      await counterCouponState(business, person.consumerId, tomorrow),
    ).toMatchObject({
      status: "selected",
      coupon: { couponId: coupon.id, label: "Un café gratis" },
    });
  }, 120_000);

  it("same_visit is worth it right away", async () => {
    const world = await welcomeWorld("Welcome same", {
      activatedAt: ON,
      redeemFrom: "same_visit",
    });
    const person = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 60_000),
    );
    await installOn(person, "dev-same");
    await issueWelcomeGifts(person.consumerId, EVENING);
    const [coupon] = await readWelcomeCoupons(world.seed.business.id);
    expect(coupon.validFrom.toISOString()).toBe(EVENING.toISOString());
  }, 120_000);

  it("ORACULO DE M2: enrolled BEFORE the switch-on, installed after → no gift", async () => {
    const world = await welcomeWorld("Welcome M2", { activatedAt: ON });
    const person = await welcomeConsumer(world, new Date(ON.getTime() - DAY));
    await installOn(person, "dev-m2");
    expect(
      await issueWelcomeGifts(person.consumerId, EVENING, {
        deviceLibraryId: "dev-m2",
      }),
    ).toBe(0);
    expect(await readWelcomeCoupons(world.seed.business.id)).toEqual([]);
  }, 120_000);

  it("a generated but NOT installed pass gets nothing", async () => {
    const world = await welcomeWorld("Welcome uninstalled", {
      activatedAt: ON,
    });
    const person = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 60_000),
    );
    expect(await issueWelcomeGifts(person.consumerId, EVENING)).toBe(0);
    expect(await readWelcomeCoupons(world.seed.business.id)).toEqual([]);
  }, 120_000);

  it("ORACULO DE M3: cap 1 and two installed enrolments → ONE coupon", async () => {
    const world = await welcomeWorld("Welcome M3", {
      activatedAt: ON,
      monthlyCap: 1,
    });
    const first = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 60_000),
    );
    const second = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 30_000),
    );
    await installOn(first, "dev-m3-a");
    await installOn(second, "dev-m3-b");
    await issueWelcomeGifts(first.consumerId, EVENING);
    await issueWelcomeGifts(
      second.consumerId,
      new Date(EVENING.getTime() + 60_000),
    );
    const coupons = await readWelcomeCoupons(world.seed.business.id);
    expect(coupons.map((c) => c.consumerId)).toEqual([first.consumerId]);
  }, 120_000);

  it("ORACULO DE M4: the cap counts the LOCAL month — a gift of 30-09 21:00 local does not count on 01-10", async () => {
    const world = await welcomeWorld("Welcome M4", {
      activatedAt: ON,
      monthlyCap: 1,
    });
    const lastMonth = new Date("2026-10-01T02:00:00.000Z"); // 2026-09-30 21:00 local
    const october = new Date("2026-10-01T15:00:00.000Z"); // 2026-10-01 10:00 local
    const first = await welcomeConsumer(
      world,
      new Date(lastMonth.getTime() - 60_000),
    );
    await installOn(first, "dev-m4-a");
    expect(await issueWelcomeGifts(first.consumerId, lastMonth)).toBe(1);
    const second = await welcomeConsumer(
      world,
      new Date(october.getTime() - 60_000),
    );
    await installOn(second, "dev-m4-b");
    expect(await issueWelcomeGifts(second.consumerId, october)).toBe(1);
    expect(await readWelcomeCoupons(world.seed.business.id)).toHaveLength(2);
  }, 120_000);

  it("ORACULO DE M5: an iPhone gifted by A keeps the business's welcome burned after A deletes the pass", async () => {
    const world = await welcomeWorld("Welcome M5", { activatedAt: ON });
    const a = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 60_000),
    );
    await installOn(a, "dev-shared");
    expect(
      await issueWelcomeGifts(a.consumerId, EVENING, {
        deviceLibraryId: "dev-shared",
      }),
    ).toBe(1);
    // A deletes the pass: PassKit's DELETE wipes the registration row.
    await unregisterDevice({ passId: a.passId, deviceLibraryId: "dev-shared" });
    const b = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() + 60_000),
    );
    await installOn(b, "dev-shared");
    const later = new Date(EVENING.getTime() + 120_000);
    expect(
      await issueWelcomeGifts(b.consumerId, later, {
        deviceLibraryId: "dev-shared",
      }),
    ).toBe(0);
    expect(
      (await readWelcomeCoupons(world.seed.business.id)).map(
        (c) => c.consumerId,
      ),
    ).toEqual([a.consumerId]);
    expect(await readWelcomeDevices(world.seed.business.id)).toEqual([
      { device: "dev-shared" },
    ]);
  }, 120_000);

  it("ORACULO DE M6: the filter is PER BUSINESS — the same iPhone gets the welcome of another business", async () => {
    const x = await welcomeWorld("Welcome M6 X", { activatedAt: ON });
    const y = await welcomeWorld("Welcome M6 Y", { activatedAt: ON });
    const a = await welcomeConsumer(x, new Date(EVENING.getTime() - 60_000));
    await installOn(a, "dev-m6");
    expect(await issueWelcomeGifts(a.consumerId, EVENING)).toBe(1);
    const b = await welcomeConsumer(y, new Date(EVENING.getTime() + 60_000));
    await installOn(b, "dev-m6");
    const later = new Date(EVENING.getTime() + 120_000);
    expect(
      await issueWelcomeGifts(b.consumerId, later, {
        deviceLibraryId: "dev-m6",
      }),
    ).toBe(1);
    expect(
      (await readWelcomeCoupons(y.seed.business.id)).map((c) => c.consumerId),
    ).toEqual([b.consumerId]);
  }, 120_000);

  it("two triggers (registration + tick sweep) → ONE coupon; the sweep recovers a lost trigger", async () => {
    const world = await welcomeWorld("Welcome double", { activatedAt: ON });
    const both = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 60_000),
    );
    const lost = await welcomeConsumer(
      world,
      new Date(EVENING.getTime() - 30_000),
    );
    await installOn(both, "dev-both");
    await installOn(lost, "dev-lost");
    expect(
      await issueWelcomeGifts(both.consumerId, EVENING, {
        deviceLibraryId: "dev-both",
      }),
    ).toBe(1);
    const summary = await runMarketingTick({
      now: new Date(EVENING.getTime() + 60_000),
      random: () => 1,
      lockNamespace: "welcome-issue-sweep",
      businessIds: [world.seed.business.id],
      consumerIds: [both.consumerId, lost.consumerId],
    });
    expect(summary).toMatchObject({ welcomeIssued: 1 });
    const coupons = await readWelcomeCoupons(world.seed.business.id);
    expect(coupons.map((c) => c.consumerId).sort()).toEqual(
      [both.consumerId, lost.consumerId].sort(),
    );
    expect(
      await issueWelcomeGifts(both.consumerId, EVENING, {
        deviceLibraryId: "dev-both",
      }),
    ).toBe(0);
  }, 120_000);
});
