import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { SESSION_COOKIE } from "@mi-pasaporte/domain/server/consumer/core";
import { getEnrollLanding } from "@mi-pasaporte/domain/server/consumer/enrollment";
import { issueSession } from "@mi-pasaporte/domain/server/consumer/session";
import { issueWelcomeGifts } from "@mi-pasaporte/domain/server/marketing/welcome-issue";
import { GET } from "../app/api/public/consumer/coupons/route";
import {
  DAY,
  dropWelcomeWorlds,
  installOn,
  readWelcomeCoupons,
  welcomeConsumer,
  welcomeWorld,
} from "./marketing-welcome-support";

/**
 * What the UI reads of «Bienvenida» (spec 0107 §6, E5): the offer on the enroll page
 * (`getEnrollLanding`) and the gift «desde mañana» in the consumer's coupons, through the
 * REAL route and a real session, the day it is given.
 */

afterAll(dropWelcomeWorlds, 120_000);

async function couponsOf(consumerId: string) {
  const response = await GET(
    new NextRequest("https://mp.test/api/public/consumer/coupons", {
      headers: {
        cookie: `${SESSION_COOKIE}=${await issueSession(consumerId)}`,
      },
    }),
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { coupons: Record<string, unknown>[] })
    .coupons;
}

describe.skipIf(!integrationEnabled)(
  "welcome gift — what the UI reads (E5)",
  () => {
    it("the enroll page carries the offer, without cost, cap or ids; null once the month's cap is reached", async () => {
      const now = Date.now();
      const world = await welcomeWorld("Welcome landing", {
        activatedAt: new Date(now - DAY),
        monthlyCap: 1,
        validDays: 30,
      });
      const landing = await getEnrollLanding(world.seed.programId);
      expect(landing?.welcomeOffer).toEqual({
        message: "Sumate hoy y en tu próxima visita te llevás un regalo",
        label: "Un café gratis",
        kind: "free_product",
        rule: null,
        validDays: 30,
        redeemFrom: "next_day",
      });

      const person = await welcomeConsumer(world, new Date(now - 60_000));
      await installOn(person, `dev-landing-${now}`);
      expect(await issueWelcomeGifts(person.consumerId)).toBe(1);
      expect(
        (await getEnrollLanding(world.seed.programId))?.welcomeOffer,
      ).toBeNull();
    }, 120_000);

    it("ORACULO DE M13: the day of the gift, the consumer's list carries it `scheduled` with its validFrom", async () => {
      const now = Date.now();
      const world = await welcomeWorld("Welcome scheduled", {
        activatedAt: new Date(now - DAY),
      });
      const person = await welcomeConsumer(world, new Date(now - 60_000));
      await installOn(person, `dev-scheduled-${now}`);
      expect(await issueWelcomeGifts(person.consumerId)).toBe(1);
      const [coupon] = await readWelcomeCoupons(world.seed.business.id);
      expect(coupon.validFrom.getTime()).toBeGreaterThan(Date.now());
      expect(await couponsOf(person.consumerId)).toEqual([
        expect.objectContaining({
          id: coupon.id,
          label: "Un café gratis",
          status: "scheduled",
          reason: null,
          validFrom: coupon.validFrom.toISOString(),
          validUntil: coupon.validUntil.toISOString(),
        }),
      ]);
    }, 120_000);
  },
);
