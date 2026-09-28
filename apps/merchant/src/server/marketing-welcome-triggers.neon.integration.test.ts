import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { POST as register } from "../app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serialNumber]/route";
import { POST as enrollRoute } from "../app/api/public/enroll/[programId]/route";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { consumerAccounts } from "./schema";
import { seedLocationsBusiness } from "./locations-integration-support";
import {
  DAY,
  dropWelcomeWorlds,
  installOn,
  readWelcomeCoupons,
  readWelcomeDevices,
  welcomeConsumer,
  welcomeWorld,
  welcomeWorlds,
} from "./marketing-welcome-support";

/**
 * The WIRING of the welcome gift (spec 0107 §3): a trigger route that forgets to call
 * `issueWelcomeGifts` still answers 201 and the rule's own tests stay green — only a case
 * that goes THROUGH the route sees it. No tick runs in this file: the coupon can only come
 * from the route.
 */

afterAll(dropWelcomeWorlds, 120_000);

describe.skipIf(!integrationEnabled)("welcome gift — trigger routes", () => {
  it("ORACULO DE M7: PassKit's registration issues the gift (no tick)", async () => {
    const now = Date.now();
    const world = await welcomeWorld("Welcome M7", {
      activatedAt: new Date(now - DAY),
    });
    const person = await welcomeConsumer(world, new Date(now - 60_000));
    const device = `dev-m7-${now}`;
    const response = await register(
      new NextRequest(
        `https://example.test/api/public/wallet/passkit/v1/devices/${device}/registrations/pass.x/${person.serial}`,
        {
          method: "POST",
          headers: {
            authorization: `ApplePass ${person.authToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ pushToken: "apns-token" }),
        },
      ),
      {
        params: Promise.resolve({
          deviceLibraryId: device,
          passTypeId: "pass.x",
          serialNumber: person.serial,
        }),
      },
    );
    expect(response.status).toBe(201);
    const coupons = await readWelcomeCoupons(world.seed.business.id);
    expect(coupons.map((c) => c.membershipId)).toEqual([person.membershipId]);
    expect(await readWelcomeDevices(world.seed.business.id)).toEqual([
      { device },
    ]);
  }, 120_000);

  it("the ENROLL route issues the gift to a consumer whose pass is already installed by ANOTHER business (no tick)", async () => {
    const now = Date.now();
    // The other business: no welcome of its own, it is where the pass was installed.
    const other = await seedLocationsBusiness(`Welcome other ${now}`, "plus");
    welcomeWorlds.push(other.business.id);
    const world = await welcomeWorld("Welcome enroll", {
      activatedAt: new Date(now - DAY),
    });
    // Enrolled in `other` with its Apple pass installed on an iPhone...
    const person = await welcomeConsumer(
      { seed: other, campaignId: "" },
      new Date(now - 2 * DAY),
    );
    await installOn(person, `dev-enroll-${now}`);
    const [account] = await getDb()
      .select({ phone: consumerAccounts.phoneE164 })
      .from(consumerAccounts)
      .where(eq(consumerAccounts.id, person.consumerId));
    // ...and now it signs up to the welcome business through the public route.
    const response = await enrollRoute(
      new NextRequest(
        `https://example.test/api/public/enroll/${world.seed.programId}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            firstName: "Marcos",
            lastName: "Pérez",
            phoneE164: account.phone,
            countryIso: "EC",
          }),
        },
      ),
      { params: Promise.resolve({ programId: world.seed.programId }) },
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      existingAccount: boolean;
      membership: { id: string };
    };
    expect(body.existingAccount).toBe(true);
    const coupons = await readWelcomeCoupons(world.seed.business.id);
    expect(coupons.map((c) => [c.consumerId, c.membershipId])).toEqual([
      [person.consumerId, body.membership.id],
    ]);
  }, 120_000);
});
