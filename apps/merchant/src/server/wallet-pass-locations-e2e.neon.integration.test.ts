import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import {
  NEAR,
  NEAR_TWIN,
  seedCampaign,
  seedLocation,
  seedMembership,
  seedTurn,
} from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";
import { getDb } from "./db";
import { passPlacements } from "./schema";
import { passLocationsForConsumer } from "./wallet/pass-locations-store";
import { walletProviderFromEnv } from "./wallet/provider";

/**
 * The two segments of «the doors reach the pass» that NOTHING pinned before, both found
 * by the independent review of phase A (`docs/TASKS.md`, dimension 2, findings M1/M3):
 *
 *  1. The READER: `passLocationsForConsumer` runs real SQL over `consumer.pass_placement`
 *     joined to the location, the business and (LEFT) the turn. Turning that `leftJoin`
 *     into an `innerJoin` erased every UTILITY door — the balance the consumer sees —
 *     with 162 tests green, because the only suite that named the reader MOCKED it.
 *  2. The PROVIDER → BUILDER segment: making `walletProviderFromEnv` drop `passLocations`
 *     on its way to `buildApplePkpass` served a pass with NO `locations` — geofence
 *     silently off — with typecheck, lint and all 84 wallet tests green.
 *
 * `wallet-pass-locations-wiring.test.ts` pins the ROUTE → reader hop and says, honestly,
 * that everything around it is mocked. This file is the other half: no mocks at all, from
 * a row in the database to the bytes of `pass.json` and to the Google save JWT.
 *
 * Both doors matter and for different reasons: the utility one (`turn_id` null) is the
 * one an `innerJoin` loses, and a test carrying only a turn door would stay green on the
 * exact mutation this exists to catch.
 *
 * No secrets needed: outside production `walletProviderFromEnv` signs Apple with
 * `selfSignedSigner()` and builds Google through `fakeBuildGoogleSaveUrl`, which calls
 * the REAL `buildGoogleSaveJwt` → `buildLoyaltyObject`. The wiring under test is the
 * production one.
 */

let seed: Seed;
let consumerId: string;
const BUSINESS_NAME = `Pass e2e ${Date.now()}`;

const INPUT = {
  qrToken: "qr-e2e-0065",
  firstName: "Marcos",
  lastName: "Pereira",
  origin: "https://www.checkpass.club",
  webViewToken: "wvt-e2e-0065",
};

describe.skipIf(!integrationEnabled)("the doors reach the pass", () => {
  beforeAll(async () => {
    seed = await seedBusiness({
      name: BUSINESS_NAME,
      kind: "stamps",
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    const consumer = await seedConsumer();
    consumerId = consumer.id;
    const membershipId = await seedMembership({
      consumerId,
      programId: seed.programId,
      businessId: seed.business.id,
      enrolledAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    const utilityDoor = await seedLocation({
      businessId: seed.business.id,
      ...NEAR,
    });
    const turnDoor = await seedLocation({
      businessId: seed.business.id,
      ...NEAR_TWIN,
    });
    const campaignId = await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [turnDoor],
    });
    const turnId = await seedTurn({
      campaignId,
      businessId: seed.business.id,
      consumerId,
      membershipId,
      locationId: turnDoor,
      status: "active",
      messageSnapshot: "2x1 en picadas",
    });

    // Seeded directly: the subject here is the READER and the wiring after it, not the
    // planner (which `marketing-placement`/`marketing-tick` already pin). Writing the
    // rows by hand is what lets a UTILITY door (`turn_id` null) exist next to a turn one.
    await getDb()
      .insert(passPlacements)
      .values([
        {
          consumerId,
          locationId: utilityDoor,
          slotKind: "utility",
          turnId: null,
          businessId: seed.business.id,
          relevantText: `${BUSINESS_NAME}: te faltan 2 sellos`,
        },
        {
          consumerId,
          locationId: turnDoor,
          slotKind: "turn",
          turnId,
          businessId: seed.business.id,
          relevantText: `${BUSINESS_NAME}: 2x1 en picadas`,
        },
      ]);
  }, 120_000);

  afterAll(async () => {
    await getDb()
      .delete(passPlacements)
      .where(eq(passPlacements.consumerId, consumerId));
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }, 120_000);

  it("the reader returns BOTH doors, the utility one included", async () => {
    const doors = await passLocationsForConsumer(consumerId);

    expect(doors).toHaveLength(2);
    expect(doors.map((door) => door.turn?.turnId ?? null).sort()).toEqual(
      [null, expect.any(String)].sort(),
    );
    const utility = doors.find((door) => door.turn === null);
    expect(utility).toMatchObject({
      latitude: Number(NEAR.latitude),
      longitude: Number(NEAR.longitude),
      businessName: BUSINESS_NAME,
      relevantText: `${BUSINESS_NAME}: te faltan 2 sellos`,
    });
  }, 120_000);

  it("Apple's pass.json carries them, through the real provider", async () => {
    const doors = await passLocationsForConsumer(consumerId);

    const { bytes } = await walletProviderFromEnv({}).buildApplePass({
      ...INPUT,
      serialNumber: randomUUID(),
      authenticationToken: "auth-e2e-0065",
      passLocations: doors,
    });

    const files = unzipSync(new Uint8Array(bytes));
    const pass = JSON.parse(Buffer.from(files["pass.json"]).toString()) as {
      locations: {
        latitude: number;
        longitude: number;
        relevantText: string;
      }[];
    };
    expect(pass.locations).toHaveLength(2);
    expect(pass.locations.map((l) => l.relevantText).sort()).toEqual(
      [
        `${BUSINESS_NAME}: 2x1 en picadas`,
        `${BUSINESS_NAME}: te faltan 2 sellos`,
      ].sort(),
    );
  }, 120_000);

  it("Google's save JWT carries them as `merchantLocations`", async () => {
    const doors = await passLocationsForConsumer(consumerId);

    const url = await walletProviderFromEnv({}).buildGoogleSaveUrl({
      ...INPUT,
      serialNumber: randomUUID(),
      passLocations: doors,
    });

    const claims = JSON.parse(
      Buffer.from(url.split("/save/")[1].split(".")[1], "base64url").toString(),
    ) as {
      payload: {
        loyaltyObjects: {
          merchantLocations?: { latitude: number; longitude: number }[];
          locations?: unknown[];
        }[];
      };
    };
    const object = claims.payload.loyaltyObjects[0];
    expect(object.merchantLocations).toHaveLength(2);
    // `locations` is deprecated and does NOT trigger geo notifications (ADR 0065).
    expect(object.locations).toBeUndefined();
  }, 120_000);
});
