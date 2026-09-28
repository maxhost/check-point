import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { POST as register } from "../app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serialNumber]/route";
import {
  DAY,
  dropWelcomeWorlds,
  readWelcomeCoupons,
  readWelcomeDevices,
  welcomeConsumer,
  welcomeWorld,
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
});
