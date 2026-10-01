import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { walletPushQueue } from "@mi-pasaporte/db/schema";
import { gateCampaignPush } from "@mi-pasaporte/domain/server/marketing/push-delivery";
import { runMarketingTick } from "./marketing/tick";
import { issueWelcomeGifts } from "@mi-pasaporte/domain/server/marketing/welcome-issue";
import {
  DAY,
  type WelcomeConsumer,
  type WelcomeWorld,
  dropWelcomeWorlds,
  installOn,
  readWelcomeCoupons,
  redeemWelcome,
  welcomeConsumer,
  welcomeWorld,
} from "./marketing-welcome-support";

/**
 * The EXPIRY NOTICE of the welcome gift (spec 0107 §5, E4), in Guayaquil (UTC−5, push
 * hours 9–21 local). The gift is delivered at 2026-10-01 21:00 local (02:00Z of the 2nd),
 * 15 days / notice 3 days before: due at 2026-10-14 02:00Z. Read BY SQL.
 */

afterAll(dropWelcomeWorlds, 120_000);

const ON = new Date("2026-09-01T12:00:00.000Z");
const GIVEN = new Date("2026-10-02T02:00:00.000Z");
/** 2026-10-14 10:00 local: past the due instant and inside the push hours. */
const DUE_DAY = new Date("2026-10-14T15:00:00.000Z");

async function gifted(label: string): Promise<{
  world: WelcomeWorld;
  person: WelcomeConsumer;
  couponId: string;
}> {
  const world = await welcomeWorld(label, { activatedAt: ON });
  const person = await welcomeConsumer(
    world,
    new Date(GIVEN.getTime() - 60_000),
  );
  await installOn(person, `dev-${label}`);
  expect(await issueWelcomeGifts(person.consumerId, GIVEN)).toBe(1);
  const [coupon] = await readWelcomeCoupons(world.seed.business.id);
  return { world, person, couponId: coupon.id };
}

function tick(world: WelcomeWorld, person: WelcomeConsumer, now: Date) {
  return runMarketingTick({
    now,
    random: () => 1,
    lockNamespace: "welcome-reminder",
    businessIds: [world.seed.business.id],
    consumerIds: [person.consumerId],
  });
}

async function notices(consumerId: string) {
  return await getDb()
    .select({
      id: walletPushQueue.id,
      class: walletPushQueue.class,
      title: walletPushQueue.title,
      body: walletPushQueue.body,
      status: walletPushQueue.status,
      lastError: walletPushQueue.lastError,
    })
    .from(walletPushQueue)
    .where(eq(walletPushQueue.consumerId, consumerId));
}

describe.skipIf(!integrationEnabled)(
  "welcome gift — expiry notice (E4)",
  () => {
    it("ORACULO DE M12: at delivery + 5 d (15 d / 3 d) there is NO notice yet", async () => {
      const { world, person } = await gifted("Welcome M12");
      await tick(world, person, new Date(GIVEN.getTime() + 5 * DAY));
      expect(await notices(person.consumerId)).toEqual([]);
      expect(
        (await readWelcomeCoupons(world.seed.business.id))[0].reminderQueueId,
      ).toBeNull();
    }, 120_000);

    it("at valid_until − 3 d the tick queues ONE notice, and a second tick queues no other", async () => {
      const { world, person } = await gifted("Welcome due");
      await tick(world, person, DUE_DAY);
      await tick(world, person, new Date(DUE_DAY.getTime() + 60_000));
      const queued = await notices(person.consumerId);
      expect(queued).toEqual([
        {
          id: expect.any(String),
          class: "campaign",
          title: expect.stringContaining("Welcome due"),
          body: "Tu regalo de bienvenida vence en 3 días",
          status: "pending",
          lastError: null,
        },
      ]);
      expect(
        (await readWelcomeCoupons(world.seed.business.id))[0].reminderQueueId,
      ).toBe(queued[0].id);
      // Not redeemed and inside the hours: the gate lets it go, with no click id.
      expect(await gateCampaignPush(queued[0].id, DUE_DAY)).toEqual({
        kind: "send",
      });
    }, 120_000);

    it("ORACULO DE M11: redeemed before the send → the gate CANCELS the notice", async () => {
      const { world, person, couponId } = await gifted("Welcome M11");
      await tick(world, person, DUE_DAY);
      const [queued] = await notices(person.consumerId);
      await redeemWelcome(world, person, couponId);
      expect(await gateCampaignPush(queued.id, DUE_DAY)).toEqual({
        kind: "cancel",
        reason: "redeemed",
      });
      expect(await notices(person.consumerId)).toMatchObject([
        { id: queued.id, status: "cancelled", lastError: "redeemed" },
      ]);
    }, 120_000);
  },
);
