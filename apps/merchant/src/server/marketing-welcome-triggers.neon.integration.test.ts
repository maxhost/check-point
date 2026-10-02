import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { POST as register } from "../../../consumer/src/app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serialNumber]/route";
import { POST as enrollRoute } from "../../../consumer/src/app/api/public/enroll/[programId]/route";
import { POST as homeLaunch } from "../../../consumer/src/app/api/public/home/launch/route";
import { POST as subscribe } from "../../../consumer/src/app/api/public/push/subscribe/route";
import { issueSession } from "@mi-pasaporte/domain/server/consumer/session";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import {
  FakeWebPushChannel,
  webPushChannelFromEnv,
} from "@mi-pasaporte/domain/server/push/webpush-channel";
import { seedLocationsBusiness } from "./locations-integration-support";
import {
  DAY,
  activateHomePush,
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
  it("Home launch then push opt-in issues one gift and one first notice", async () => {
    const now = Date.now();
    const world = await welcomeWorld("Welcome Home", {
      activatedAt: new Date(now - DAY),
    });
    const person = await welcomeConsumer(world, new Date(now - 60_000));
    const session = await issueSession(person.consumerId);
    const headers = { cookie: `${SESSION_COOKIE}=${session}` };

    const launched = await homeLaunch(
      new NextRequest("https://example.test/api/public/home/launch", {
        method: "POST",
        headers,
      }),
    );
    expect(launched.status).toBe(200);
    expect(await readWelcomeCoupons(world.seed.business.id)).toEqual([]);

    const url = "https://push.test/welcome-home-" + now;
    const channel = webPushChannelFromEnv() as FakeWebPushChannel;
    const beforePushes = channel.calls.length;
    const body = JSON.stringify({
      endpoint: url,
      keys: { p256dh: "test-key", auth: "test-auth" },
    });
    async function optIn() {
      return subscribe(
        new NextRequest("https://example.test/api/public/push/subscribe", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body,
        }),
      );
    }
    const first = await optIn();
    expect(first.status).toBe(201);
    expect((await first.json()).welcomeIssued).toBe(1);
    expect(channel.calls.slice(beforePushes)).toHaveLength(1);
    expect(channel.calls.at(-1)?.payload.title).toContain("bienvenida");
    expect(await readWelcomeCoupons(world.seed.business.id)).toHaveLength(1);
    const replay = await optIn();
    expect((await replay.json()).welcomeIssued).toBe(0);
    expect(channel.calls.slice(beforePushes)).toHaveLength(1);
    expect(await readWelcomeCoupons(world.seed.business.id)).toHaveLength(1);
  }, 120_000);

  it("PassKit registration can recover an eligible welcome trigger (no tick)", async () => {
    const now = Date.now();
    const world = await welcomeWorld("Welcome M7", {
      activatedAt: new Date(now - DAY),
    });
    const person = await welcomeConsumer(world, new Date(now - 60_000));
    await activateHomePush(person);
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
    // ...and now it signs up to the welcome business through the public route: the one-tap
    // alta of spec 0119 (the account is the session's).
    const session = await issueSession(person.consumerId);
    const response = await enrollRoute(
      new NextRequest(
        `https://example.test/api/public/enroll/${world.seed.programId}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${SESSION_COOKIE}=${session}`,
          },
          body: "{}",
        },
      ),
      { params: Promise.resolve({ programId: world.seed.programId }) },
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      membership: { id: string };
    };
    const coupons = await readWelcomeCoupons(world.seed.business.id);
    expect(coupons.map((c) => [c.consumerId, c.membershipId])).toEqual([
      [person.consumerId, body.membership.id],
    ]);
  }, 120_000);
});
