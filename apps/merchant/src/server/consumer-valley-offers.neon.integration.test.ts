import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import {
  DAY,
  base,
  category,
  crossBusiness,
  crossCampaign,
  crossConsumer,
  dropCrossWorlds,
  memberOf,
  north,
  scanAt,
} from "./consumer-cross-support";
import {
  TUESDAY,
  at,
  claimValley,
  listedBy,
  secondLocation,
  setWindows,
  valleyBusiness,
  valleyCampaign,
  valleyOffersOf,
} from "./consumer-valley-support";
import { getDb } from "./db";
import { campaigns } from "./schema";

/**
 * Spec 0113 C1 (H4) — the valley offers in «Mis beneficios» against a real base, with an
 * INJECTED clock (Tuesday 2026-10-06, Buenos Aires). Oracles of M4 (the window open NOW),
 * M5 (`not_active`: the active member never), M6 (the cross filter WIRED into the valley
 * path) and M8 (once per person and location, across campaigns). The rubros carry a
 * per-case suffix and every case stands on its own `base(n)`.
 */

afterAll(dropCrossWorlds, 180_000);

const ALL_DAY = [{ weekday: TUESDAY, startHour: 0, endHour: 24 }];

describe.skipIf(!integrationEnabled)("valley offers — C1", () => {
  it("ORACULO DE M4 — window 15–17: listed at 16:59, gone at 17:00 (local); the offer's shape", async () => {
    const cat = category("v-m4");
    const here = base(41);
    const x = await valleyBusiness("Valle m4", cat("bar"), north(here, 300));
    const campaignId = await valleyCampaign(x);
    await setWindows(x.seed.locationId, [
      { weekday: TUESDAY, startHour: 15, endHour: 17 },
    ]);
    const consumer = await crossConsumer();

    const open = await valleyOffersOf(consumer.id, here, at("16:59"));
    expect(listedBy(open, x)).toEqual([x.seed.business.id]);
    const [offer] = open.offers.filter(
      (o) => o.businessId === x.seed.business.id,
    );
    expect(offer).toMatchObject({
      type: "valley",
      campaignId,
      locationId: x.seed.locationId,
      kind: "custom",
      label: "2x1 en cerveza",
      validDays: null,
      window: {
        startHour: 15,
        endHour: 17,
        endsAt: new Date("2026-10-06T20:00:00.000Z"),
      },
    });
    expect(offer).not.toHaveProperty("couponCost");
    expect(offer).not.toHaveProperty("monthlyCap");

    expect(
      listedBy(await valleyOffersOf(consumer.id, here, at("17:00")), x),
    ).toEqual([]);
    expect(
      listedBy(await valleyOffersOf(consumer.id, here, at("14:59")), x),
    ).toEqual([]);
  }, 180_000);

  it("ORACULO DE M5 — `not_active`: a member with an order 3 days ago does not see it; a dormant one and a non-member do", async () => {
    const cat = category("v-m5");
    const here = base(42);
    const x = await valleyBusiness("Valle m5", cat("bar"), north(here, 300));
    await valleyCampaign(x, { dormantDays: 30 });
    await setWindows(x.seed.locationId, ALL_DAY);
    // Guard hermano puenteado: the LAST scan of all three is a gym (another rubro, 900 m),
    // so neither «same rubro» nor the distance can cut — only the audience does.
    const gym = await crossBusiness("Gym m5", cat("gym"), north(here, 900));
    const now = at("12:00");
    const active = await crossConsumer();
    await scanAt(
      x,
      active.id,
      new Date(now.getTime() - 3 * DAY),
      await memberOf(x, active.id),
    );
    await scanAt(gym, active.id, new Date(now.getTime() - DAY));
    const dormant = await crossConsumer();
    await scanAt(
      x,
      dormant.id,
      new Date(now.getTime() - 60 * DAY),
      await memberOf(x, dormant.id),
    );
    await scanAt(gym, dormant.id, new Date(now.getTime() - DAY));
    const stranger = await crossConsumer();
    await scanAt(gym, stranger.id, new Date(now.getTime() - DAY));

    const seen = async (id: string) =>
      listedBy(await valleyOffersOf(id, here, now), x);
    expect({
      active: await seen(active.id),
      dormant: await seen(dormant.id),
      stranger: await seen(stranger.id),
    }).toEqual({
      active: [],
      dormant: [x.seed.business.id],
      stranger: [x.seed.business.id],
    });
  }, 180_000);

  it("ORACULO DE M6 — last scan in a café: the valley of ANOTHER café 300 m away is not listed", async () => {
    const cat = category("v-m6");
    const here = base(43);
    const cafeA = await crossBusiness(
      "Cafe A m6",
      cat("cafe"),
      north(here, 1500),
    );
    const cafeB = await valleyBusiness(
      "Cafe B m6",
      cat("cafe"),
      north(here, 300),
    );
    await valleyCampaign(cafeB);
    await setWindows(cafeB.seed.locationId, ALL_DAY);
    const gym = await crossBusiness("Gym m6", cat("gym"), north(here, 1500));
    const now = at("12:00");
    const coffee = await crossConsumer();
    await scanAt(cafeA, coffee.id, new Date(now.getTime() - DAY));
    // Control, identical but its last scan is a gym: it DOES see the valley.
    const control = await crossConsumer();
    await scanAt(gym, control.id, new Date(now.getTime() - DAY));

    expect(listedBy(await valleyOffersOf(coffee.id, here, now), cafeB)).toEqual(
      [],
    );
    expect(
      listedBy(await valleyOffersOf(control.id, here, now), cafeB),
    ).toEqual([cafeB.seed.business.id]);
  }, 180_000);

  it("ORACULO DE M8 — a valley coupon of this location (of an ENDED campaign) hides the new campaign there; the claim is 404", async () => {
    const cat = category("v-m8");
    const here = base(44);
    const x = await valleyBusiness("Valle m8", cat("bar"), north(here, 300));
    const first = await valleyCampaign(x);
    await setWindows(x.seed.locationId, ALL_DAY);
    const now = at("12:00");
    const consumer = await crossConsumer();
    const control = await crossConsumer();
    expect(
      (await claimValley(consumer.id, first, x.seed.locationId, here, now))
        .status,
    ).toBe(201);
    // ONE live run per business and template: the second campaign comes after the first ends.
    await getDb()
      .update(campaigns)
      .set({ status: "ended", endedAt: now })
      .where(eq(campaigns.id, first));
    const second = await valleyCampaign(x);

    expect(listedBy(await valleyOffersOf(consumer.id, here, now), x)).toEqual(
      [],
    );
    expect(
      (await claimValley(consumer.id, second, x.seed.locationId, here, now))
        .status,
    ).toBe(404);
    // The control never claimed there: it sees the new one.
    const offers = await valleyOffersOf(control.id, here, now);
    expect(
      offers.offers
        .filter((o) => o.businessId === x.seed.business.id)
        .map((o) => o.campaignId),
    ).toEqual([second]);
  }, 180_000);

  it("once per LOCATION, not per campaign: the same campaign at a second location is still offered and claimed", async () => {
    const cat = category("v-2loc");
    const here = base(45);
    const x = await valleyBusiness(
      "Valle 2 locales",
      cat("bar"),
      north(here, 300),
    );
    const campaignId = await valleyCampaign(x);
    const other = await secondLocation(x, north(here, 600));
    await setWindows(x.seed.locationId, ALL_DAY);
    await setWindows(other, ALL_DAY);
    const now = at("12:00");
    const consumer = await crossConsumer();
    const before = await valleyOffersOf(consumer.id, here, now);
    const where = (body: typeof before) =>
      body.offers
        .filter((o) => o.businessId === x.seed.business.id)
        .map((o) => (o.type === "valley" ? o.locationId : null));
    expect(where(before)).toEqual([x.seed.locationId, other]);
    expect(
      (await claimValley(consumer.id, campaignId, x.seed.locationId, here, now))
        .status,
    ).toBe(201);
    expect(where(await valleyOffersOf(consumer.id, here, now))).toEqual([
      other,
    ]);
    expect(
      (await claimValley(consumer.id, campaignId, other, here, now)).status,
    ).toBe(201);
    expect(where(await valleyOffersOf(consumer.id, here, now))).toEqual([]);
  }, 180_000);

  it("order: the valley offers first (they close today), then the cross ones by distance", async () => {
    const cat = category("v-order");
    const here = base(46);
    const far = await valleyBusiness(
      "Valle lejos",
      cat("bar"),
      north(here, 1500),
    );
    await valleyCampaign(far);
    await setWindows(far.seed.locationId, ALL_DAY);
    const near = await crossBusiness(
      "Cruz cerca",
      cat("gym"),
      north(here, 200),
    );
    await crossCampaign(near);
    const consumer = await crossConsumer();
    const body = await valleyOffersOf(consumer.id, here, at("12:00"));
    expect(
      body.offers
        .filter((o) =>
          [far.seed.business.id, near.seed.business.id].includes(o.businessId),
        )
        .map((o) => [o.businessId, o.type]),
    ).toEqual([
      [far.seed.business.id, "valley"],
      [near.seed.business.id, "cross"],
    ]);
  }, 180_000);
});
