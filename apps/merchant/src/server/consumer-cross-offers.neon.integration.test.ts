import { afterAll, describe, expect, it } from "vitest";
import { CROSS_ON_DEMAND_ENABLED } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { integrationEnabled } from "./counter-integration-support";
import {
  DAY,
  base,
  category,
  crossBusiness,
  crossCampaign,
  crossConsumer,
  distance,
  dropCrossWorlds,
  memberOf,
  north,
  offeredBy,
  offersOf,
  scanAt,
} from "./consumer-cross-support";
import { seedOrder } from "./marketing-integration-support";
import { optOut } from "./marketing-integration-support";

/**
 * Spec 0136 C1 — `GET /api/public/consumer/cross-offers` against a real base, through the
 * REAL route and a real session. Each case pins one rule of the filter and carries a
 * CONTROL offer that passes, so an empty list can never be the reason a case is green.
 * Oracles of M1–M5 of the spec's table (the guard each one bypasses is written in the case).
 */

afterAll(dropCrossWorlds, 180_000);

const HOUR = 3_600_000;

// Spec 0143 / ADR 0117 §5: the on-demand list is OFF, so this suite is skipped with the flag.
const skip = !integrationEnabled || !CROSS_ON_DEMAND_ENABLED;

describe.skipIf(skip)("cross offers — C1", () => {
  it("without GPS and without any geocoded scan: origin none, no offers", async () => {
    const cat = category("none");
    const gym = await crossBusiness("Cruz none gym", cat("gym"), base(1));
    await crossCampaign(gym);
    const consumer = await crossConsumer();
    expect(await offersOf(consumer.id)).toEqual({ origin: "none", offers: [] });
    // The same consumer WITH GPS next to it sees it: the base is not empty.
    const withGps = await offersOf(consumer.id, north(gym.point, 300));
    expect(withGps.origin).toBe("gps");
    expect(offeredBy(withGps, gym)).toEqual([gym.seed.business.id]);
  }, 180_000);

  it("ORACULO DE M1 — without GPS, the rubro of the LAST scanned business excludes its peers", async () => {
    // Guard bypassed: «standing at» never runs without GPS, so only reason 2a can drop B.
    const cat = category("m1");
    const cafeA = await crossBusiness("Cruz M1 cafe A", cat("cafe"), base(2));
    const cafeB = await crossBusiness(
      "Cruz M1 cafe B",
      cat("cafe"),
      north(cafeA.point, 300),
    );
    const gym = await crossBusiness(
      "Cruz M1 gym",
      cat("gym"),
      north(cafeA.point, 300),
    );
    await crossCampaign(cafeB);
    await crossCampaign(gym);
    const consumer = await crossConsumer();
    await scanAt(cafeA, consumer.id, new Date(Date.now() - HOUR));
    expect(distance(cafeA.point, cafeB.point)).toBeCloseTo(300, 0);

    const body = await offersOf(consumer.id);
    expect(body.origin).toBe("last_scan");
    expect(offeredBy(body, cafeB, gym)).toEqual([gym.seed.business.id]);
  }, 180_000);

  it("ORACULO DE M2 — with GPS, the rubro of the location where they STAND (≤ 100 m) excludes its peers", async () => {
    // Guard bypassed: the last scan is a GYM, so reason 2a (M1) cannot drop cafe D.
    const cat = category("m2");
    const gymFar = await crossBusiness("Cruz M2 gym", cat("gym"), base(3));
    const here = north(base(3), 5000);
    const cafeC = await crossBusiness(
      "Cruz M2 cafe C",
      cat("cafe"),
      north(here, 50),
    );
    const cafeD = await crossBusiness(
      "Cruz M2 cafe D",
      cat("cafe"),
      north(here, 400),
    );
    const bakery = await crossBusiness(
      "Cruz M2 bakery",
      cat("bakery"),
      north(here, 400),
    );
    await crossCampaign(cafeD);
    await crossCampaign(bakery);
    const consumer = await crossConsumer();
    await scanAt(gymFar, consumer.id, new Date(Date.now() - HOUR));
    expect(distance(here, cafeC.point)).toBeCloseTo(50, 0);
    expect(distance(here, cafeD.point)).toBeCloseTo(400, 0);

    const body = await offersOf(consumer.id, here);
    expect(body.origin).toBe("gps");
    expect(offeredBy(body, cafeD, bakery)).toEqual([bakery.seed.business.id]);
  }, 180_000);

  it("ORACULO DE M3 — the 2 km radius: ~1.9 km is in, ~2.5 km is out; nearest first (O6)", async () => {
    const cat = category("m3");
    const here = base(4);
    const near = await crossBusiness(
      "Cruz M3 near",
      cat("gym"),
      north(here, 800),
    );
    const inside = await crossBusiness(
      "Cruz M3 in",
      cat("pool"),
      north(here, 1900),
    );
    const outside = await crossBusiness(
      "Cruz M3 out",
      cat("spa"),
      north(here, 2500),
    );
    for (const w of [near, inside, outside]) await crossCampaign(w);
    const consumer = await crossConsumer();

    const body = await offersOf(consumer.id, here);
    expect(offeredBy(body, near, inside, outside)).toEqual([
      near.seed.business.id,
      inside.seed.business.id,
    ]);
    const mine = body.offers.find(
      (offer) => offer.businessId === inside.seed.business.id,
    )!;
    expect(mine.distanceMeters).toBe(Math.round(distance(here, inside.point)));
  }, 180_000);

  it("ORACULO DE M4 — `non_members`: an active member of X does not see X's offer", async () => {
    // Other rubro, 300 m, no opt-out: only the audience can drop it.
    const cat = category("m4");
    const here = base(5);
    const x = await crossBusiness("Cruz M4 X", cat("gym"), north(here, 300));
    const y = await crossBusiness("Cruz M4 Y", cat("pool"), north(here, 300));
    await crossCampaign(x);
    await crossCampaign(y);
    const consumer = await crossConsumer();
    await memberOf(x, consumer.id);

    expect(offeredBy(await offersOf(consumer.id, here), x, y)).toEqual([
      y.seed.business.id,
    ]);
  }, 180_000);

  it("ORACULO DE M5 — `dormant` 30 d: an order 5 days ago does not see it, 40 days ago does", async () => {
    // Other rubro, 300 m, no opt-out; the LAST scan of both is a gym elsewhere (1 h ago),
    // so the order at X never makes X «the last scanned rubro».
    const cat = category("m5");
    const here = base(6);
    const x = await crossBusiness("Cruz M5 X", cat("gym"), north(here, 300));
    const other = await crossBusiness(
      "Cruz M5 gym",
      cat("box"),
      north(here, 9000),
    );
    await crossCampaign(x, { audience: "dormant", dormantDays: 30 });
    const seen: Record<number, string[]> = {};
    for (const daysAgo of [5, 40]) {
      const consumer = await crossConsumer();
      const membershipId = await memberOf(x, consumer.id);
      await seedOrder({
        businessId: x.seed.business.id,
        locationId: x.seed.locationId,
        programId: x.seed.programId,
        membershipId,
        consumerId: consumer.id,
        userId: x.seed.userId,
        createdAt: new Date(Date.now() - daysAgo * DAY),
      });
      await scanAt(other, consumer.id, new Date(Date.now() - HOUR));
      seen[daysAgo] = offeredBy(await offersOf(consumer.id, here), x);
    }
    expect(seen).toEqual({ 5: [], 40: [x.seed.business.id] });
    // A NON-member is not «dormant».
    const stranger = await crossConsumer();
    expect(offeredBy(await offersOf(stranger.id, here), x)).toEqual([]);
  }, 180_000);

  it("O7 — a consumer who turned X's promotions off does not see X's offer (audience any)", async () => {
    const cat = category("o7");
    const here = base(7);
    const x = await crossBusiness("Cruz O7 X", cat("gym"), north(here, 300));
    await crossCampaign(x, { audience: "any" });
    const on = await crossConsumer();
    await memberOf(x, on.id);
    const off = await crossConsumer();
    await optOut(await memberOf(x, off.id), new Date(Date.now() - DAY));

    expect(offeredBy(await offersOf(on.id, here), x)).toEqual([
      x.seed.business.id,
    ]);
    expect(offeredBy(await offersOf(off.id, here), x)).toEqual([]);
  }, 180_000);

  it("the offer carries EXACTLY the contract's keys — no cost, no cap, no membership, no R2 key", async () => {
    const cat = category("keys");
    const here = base(8);
    const x = await crossBusiness("Cruz keys", cat("gym"), north(here, 640));
    const campaignId = await crossCampaign(x, { validDays: 7 });
    const consumer = await crossConsumer();
    const [offer] = (await offersOf(consumer.id, here)).offers.filter(
      (o) => o.businessId === x.seed.business.id,
    );
    expect(Object.keys(offer).sort()).toEqual([
      "businessId",
      "businessName",
      "campaignId",
      "currencyCode",
      "discountUnit",
      "discountValue",
      "distanceMeters",
      "extraUnits",
      "kind",
      "label",
      "logoPath",
      "message",
      "nearestLocation",
      "rule",
      // Spec 0113 (contract H4): every offer says its `type`.
      "type",
      "validDays",
    ]);
    expect(offer).toMatchObject({
      campaignId,
      label: "10% en tu primera clase",
      kind: "discount",
      discountUnit: "percent",
      discountValue: "10.00",
      currencyCode: "USD",
      validDays: 7,
      distanceMeters: 640,
      logoPath: null,
      nearestLocation: { addressLabel: "Calle 1" },
    });
  }, 180_000);
});
