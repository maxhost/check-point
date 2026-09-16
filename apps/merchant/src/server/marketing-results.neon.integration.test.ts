import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { loadCampaignResults } from "./marketing/results-store";
import {
  dropResultsWorlds,
  type ResultsWorld,
  FOREIGN_BUSINESS,
  seedPassPlacements,
  seedResultsWorld,
  seedTickPhotos,
} from "./marketing-results-support";

/**
 * The results DTO against a real database (spec 0065 phase B2). The GATING of the effect
 * estimate is not here: it is arithmetic over four counts and `marketing/results.test.ts`
 * pins it at the boundary. What is here is everything a pure test cannot see — which
 * rows each count comes from.
 *
 * ALCANCE DECLARADO: this exercises the STORE. That the route answers 401/403 and maps
 * `CampaignError` is `marketing-routes.test.ts`; that the screen hides the estimate is
 * the render test of phase B3.
 */

const COUPON = { label: "2x1 en picadas", cap: 50 };

/**
 * ONE world for every assertion, plus a second one that carries the tick photos. The DTO
 * only reads, so nothing here can be polluted by the test that ran before — and seeding
 * seven consumers per test cost 5 s each and timed out nine times out of nine.
 *
 * The photos live in their OWN world so that «with no tick yet the photo is null» does
 * not depend on running before the test that inserts them. A suite whose result changes
 * with the order of its cases is a flaky that has not happened yet.
 */
let world: ResultsWorld;
let photoWorld: ResultsWorld;
let lastRanAt: Date;

beforeAll(async () => {
  if (!integrationEnabled) return;
  world = await seedResultsWorld();
  await seedPassPlacements(world);
  photoWorld = await seedResultsWorld();
  lastRanAt = await seedTickPhotos(photoWorld.campaignId);
}, 180_000);

afterAll(dropResultsWorlds, 120_000);

describe.skipIf(!integrationEnabled)("campaign results", () => {
  it("counts turns by status, and `held` apart from the holdouts of the rate", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    expect(results.turns).toEqual({
      quality: "observada",
      queued: 0,
      active: 1,
      done: 5,
      cancelled: 1,
      held: 1,
    });
    // One withheld turn EXISTS and it is already `done`, so here the two numbers agree.
    // They are still read from different filters: `held` ignores status, the rate does
    // not. The unit test is what pins them apart.
    expect(results.windowPurchases.held).toEqual({ purchases: 0, of: 1 });
  }, 120_000);

  it("a `coupon_redeemed` outcome counts as bought, exactly like the queue's merit", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    // Four placed turns are `done`: one `purchase`, two `coupon_redeemed`, one `none`.
    // Reading only `'purchase'` would report 1 of 4 — a campaign whose coupon worked,
    // shown as if nobody had come, and disagreeing with the ranking of its own queue.
    expect(results.windowPurchases.placed).toEqual({ purchases: 3, of: 4 });
    expect(results.windowPurchases.title).toBe("Compraron durante su ventana");
  }, 120_000);

  it("with one holdout the effect is `no_disponible`, not a small number", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    expect(results.effect).toEqual({
      quality: "no_disponible",
      holdoutN: 1,
      needed: 30,
    });
  }, 120_000);

  it("the incurred cost sums the SNAPSHOTS, not `n × costo actual`", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    // The two redemptions were honoured at 3.00 and 4.50 while the campaign's current
    // coupon cost is 3.00. `n × costo` would say 6.00 and would keep changing every time
    // somebody edits a paused campaign — restating money already handed over.
    expect(results.coupon.redeemed).toBe(2);
    expect(Number(results.coupon.incurredCost)).toBe(7.5);
    expect(results.coupon.quality).toBe("estimado_configurado");
    expect(results.coupon.cap).toBe(50);
  }, 120_000);

  it("reads the LAST tick photo, not whichever row the scan returns first", async () => {
    const results = await loadCampaignResults(
      photoWorld.businessId,
      photoWorld.campaignId,
      COUPON,
    );

    expect(results.audience.photo).toEqual({
      ranAt: lastRanAt,
      total: 40,
      reachable: 31,
      noLocation: 4,
      optOut: 2,
      cooldown: 3,
    });
  }, 120_000);

  it("with no tick yet the photo is null", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    expect(results.audience.photo).toBeNull();
  }, 120_000);

  it("breaks down by door, including the one that produced nothing", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    // Door C is assigned and empty: «este local no trajo a nadie» is an answer, and a
    // missing row would read as «todavía no calculado».
    expect(results.byLocation.rows).toEqual([
      {
        locationId: world.doors.a,
        name: "A Centro",
        turns: 3,
        windowPurchases: 2,
        redemptions: 1,
      },
      {
        locationId: world.doors.b,
        name: "B Norte",
        turns: 4,
        windowPurchases: 1,
        redemptions: 1,
      },
      {
        locationId: world.doors.c,
        name: "C Sin turnos",
        turns: 0,
        windowPurchases: 0,
        redemptions: 0,
      },
    ]);
  }, 120_000);

  it("counts every number, never the STRING a bare `count(*)` returns", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    // `count(*)` is a bigint and the driver hands a bare one back as the STRING `"7"`
    // (measured on the ephemeral branch); the generic of `db.execute<T>` is an assertion,
    // not a check, so it would travel into a `number` field with typecheck green. The
    // `typeof` sweep is here because `toEqual` is NOT enough on its own for the numbers
    // that never reach an exact assertion — and because `"7" + 1` is `"71"`.
    expect(results.passReach).toEqual({
      quality: "observada",
      inPass: 2,
      members: 7,
    });
    for (const value of [
      results.turns.done,
      results.windowPurchases.placed.of,
      results.coupon.redeemed,
      results.passReach.inPass,
      results.byLocation.rows[0].turns,
      results.byLocation.rows[0].redemptions,
    ])
      expect(typeof value).toBe("number");
  }, 120_000);

  it("the DTO carries no `client_request_id` and no R2 key", async () => {
    const results = await loadCampaignResults(
      world.businessId,
      world.campaignId,
      COUPON,
    );

    // Spec 0065's test plan asks for a STATIC sweep over `api/marketing/**`. This is the
    // behavioural version and it is strictly stronger: it reads the object the route
    // actually serializes, so a field added three modules away is caught too. The risk is
    // real and specific — the results walk `coupon_redemption`, which is the one table
    // here that HAS a `client_request_id`, and `CLAUDE.md` already recorded one `*ObjectKey`
    // leak caught by an independent reviewer.
    const serialized = JSON.stringify(results);
    for (const forbidden of [
      "clientRequestId",
      "client_request_id",
      "ObjectKey",
      "objectKey",
    ])
      expect(serialized).not.toContain(forbidden);
    // …and the sweep is not vacuous: it ran over a DTO that really carries the numbers.
    expect(serialized).toContain("estimado_configurado");
    expect(serialized.length).toBeGreaterThan(200);
  }, 120_000);

  it("another business gets nothing, even holding the right campaign id", async () => {
    // The route resolves the 404 with `getCampaign`; this pins the SECOND lock, the
    // `business_id` filter of the counting queries themselves.
    const results = await loadCampaignResults(
      FOREIGN_BUSINESS,
      world.campaignId,
      COUPON,
    );

    expect(results.turns.done).toBe(0);
    expect(results.windowPurchases.placed).toEqual({ purchases: 0, of: 0 });
    expect(results.coupon.redeemed).toBe(0);
    expect(results.passReach).toEqual({
      quality: "observada",
      inPass: 0,
      members: 0,
    });
  }, 120_000);
});
