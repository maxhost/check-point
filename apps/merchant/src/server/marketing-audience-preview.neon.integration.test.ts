import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  dropBusiness,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";
import { previewAudience } from "./marketing/audience-preview";
import {
  seedLocation,
  seedMembership,
  seedTurn,
  seedWalletPass,
} from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";

/**
 * The composer's counts against a real database (spec 0065 phase B2). The campaign does
 * NOT exist yet — that is the whole point of the preview — so this is also the only
 * suite that exercises `decideTurnEligibility` over doors chosen by hand instead of over
 * a saved `campaign_location`.
 *
 * Six consumers, one per branch of the ORDERED decision, so each is counted under
 * exactly one reason. The order is load-bearing (`marketing/audience.ts`): the opted-out
 * consumer also owns a pass and is dormant, and still has to land in `optOut`.
 *
 * ALCANCE DECLARADO: the query-string parsing is `marketing/audience-preview.test.ts`
 * (pure); the 401/403 of the route is `marketing-routes.test.ts`.
 */

const NOW = new Date("2026-09-16T12:00:00.000Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

type World = {
  businessId: string;
  doorA: string;
  doorB: string;
  archived: string;
  ungeocoded: string;
  /** A door of ANOTHER business: `active`, geocoded and perfectly usable — by its own
   * owner. A random uuid does NOT test this: it matches nothing whether the
   * `business_id` filter is there or not, which is how the first version of this suite
   * came out green with the filter deleted. */
  foreignDoor: string;
};

let world: World;
const businessIds: string[] = [];

beforeAll(async () => {
  if (!integrationEnabled) return;
  const seed = await seedBusiness({
    name: `Preview ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
  });
  const businessId = seed.business.id;
  businessIds.push(businessId);
  const doorA = await seedLocation({ businessId, name: "A" });
  const doorB = await seedLocation({ businessId, name: "B" });
  const archived = await seedLocation({
    businessId,
    name: "Archivada",
    status: "archived",
  });
  const ungeocoded = await seedLocation({
    businessId,
    name: "Sin mapa",
    latitude: null,
    longitude: null,
  });
  const neighbour = await seedBusiness({
    name: `Preview vecino ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
  });
  businessIds.push(neighbour.business.id);
  const foreignDoor = await seedLocation({
    businessId: neighbour.business.id,
    name: "Del vecino",
  });
  world = { businessId, doorA, doorB, archived, ungeocoded, foreignDoor };

  // One consumer per branch of the ordered decision. `origin` is what makes the door
  // attributable (ADR 0042) when there is no order.
  const people = [
    { origin: doorA, pass: true, enrolled: 400 },
    { origin: doorA, pass: true, enrolled: 400, optOut: true },
    { origin: doorA, pass: false, enrolled: 400 },
    { origin: doorA, pass: true, enrolled: 1 },
    { origin: null, pass: true, enrolled: 400 },
    { origin: doorA, pass: true, enrolled: 400, cooldown: true },
  ] as const;

  for (const person of people) {
    const consumer = await seedConsumer();
    if (person.pass) await seedWalletPass(consumer.id);
    const membershipId = await seedMembership({
      consumerId: consumer.id,
      programId: seed.programId,
      businessId,
      enrolledAt: ago(person.enrolled),
      originLocationId: person.origin,
      optedOutAt: "optOut" in person && person.optOut ? ago(3) : null,
    });
    if ("cooldown" in person && person.cooldown)
      // A `done` turn whose window closed 5 days ago: inside the 30-day cooldown. It is
      // `done` and not `cancelled` on purpose — only the turn that CONSUMED the
      // opportunity burns it (audience rule 5).
      await seedTurn({
        campaignId: await seedCooldownCampaign(businessId, seed.userId, doorA),
        businessId,
        consumerId: consumer.id,
        membershipId,
        locationId: doorA,
        status: "done",
        windowStart: ago(10),
        windowEnd: ago(5),
        outcome: "none",
      });
  }
}, 180_000);

/** The cooldown turn has to belong to SOME campaign; it is never the one being previewed
 * (there is none yet), which is exactly the case the rule covers: another campaign of the
 * same business already used this consumer's window. */
async function seedCooldownCampaign(
  businessId: string,
  userId: string,
  doorId: string,
): Promise<string> {
  const { seedCampaign } = await import("./marketing-integration-support");
  return await seedCampaign({
    businessId,
    createdByUserId: userId,
    locationIds: [doorId],
    status: "ended",
  });
}

afterAll(async () => {
  for (const businessId of businessIds.splice(0)) {
    await dropCampaigns(businessId);
    await dropBusiness(businessId);
  }
}, 120_000);

describe.skipIf(!integrationEnabled)("audience preview", () => {
  it("counts one consumer per exclusion reason, and the eligible one", async () => {
    const preview = await previewAudience(
      world.businessId,
      { dormantDays: 30, locationIds: [world.doorA, world.doorB] },
      NOW,
    );

    expect(preview).toEqual({
      quality: "observada",
      total: 6,
      // `reachable` is counted off `hasPass`, NOT off where the decision stopped: the
      // opted-out consumer owns a pass and is still reachable. Only the one without a
      // pass is missing here.
      reachable: 5,
      noLocation: 1,
      optOut: 1,
      cooldown: 1,
      eligible: 1,
      // Sorted by id, which is the order `usableDoors` now guarantees: without the
      // `order by` this line flipped between runs.
      usableLocationIds: [world.doorA, world.doorB].sort(),
    });
  }, 120_000);

  it("the dormancy floor moves with the clock, not only with `dormantDays`", async () => {
    // `dormantDays` and `now` are the two halves of the same rule
    // (`greatest(last order, enrolled) <= now - dormantDays`), and only one of them can
    // be varied from the composer. At 365 days the consumer enrolled 400 days ago is
    // still dormant; read from 300 days EARLIER the same row is not. Nothing else about
    // the fixture changes, so the count moves for exactly one reason.
    const preview = await previewAudience(
      world.businessId,
      { dormantDays: 365, locationIds: [world.doorA, world.doorB] },
      NOW,
    );

    expect(preview.total).toBe(6);
    expect(preview.eligible).toBe(1);

    const stricter = await previewAudience(
      world.businessId,
      { dormantDays: 365, locationIds: [world.doorA, world.doorB] },
      new Date(NOW.getTime() - 300 * DAY),
    );
    expect(stricter.eligible).toBe(0);
  }, 120_000);

  it("choosing NO door leaves everybody without an attributable one", async () => {
    const preview = await previewAudience(
      world.businessId,
      { dormantDays: 30, locationIds: [] },
      NOW,
    );

    // Not an error and not a blank: the honest answer while the owner is still
    // choosing. THREE and not five, because the decision is ORDERED and `no_location` is
    // rule 4: the opted-out consumer and the one without a pass stop before reaching it,
    // and the one enrolled yesterday is `not_dormant` at rule 3. The consumer in
    // cooldown DOES land here — rule 5 comes after.
    expect(preview.usableLocationIds).toEqual([]);
    expect(preview.eligible).toBe(0);
    expect(preview.noLocation).toBe(3);
  }, 120_000);

  it("an archived door, one without coordinates and ANOTHER business's are not usable", async () => {
    const preview = await previewAudience(
      world.businessId,
      {
        dormantDays: 30,
        locationIds: [
          world.doorA,
          world.archived,
          world.ungeocoded,
          world.foreignDoor,
          randomUUID(),
        ],
      },
      NOW,
    );

    // The composer marks the difference between what was chosen and what came back.
    // Finding out at `activate` (409 `no_usable_location`) is finding out too late. The
    // neighbour's door is the one that matters: it is `active` and geocoded, so the ONLY
    // thing keeping it out is the `business_id` filter — without it the preview becomes
    // an oracle telling an owner whether somebody else's location exists and where.
    expect(preview.usableLocationIds).toEqual([world.doorA]);
  }, 120_000);
});
