import { and, or, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  readBalances,
} from "./counter-integration-support";
import {
  COST,
  DISPENSED_COST,
  type RedeemWorld,
  TARGET,
  dropRedeemWorld,
  newCard,
  readLog,
  readPushes,
  redeemBody,
  seedRedeemWorld,
} from "./counter-redeem-support";
import { getDb } from "./db";
import { programMemberships } from "./schema";
import { redeemReward } from "./counter/redeem";

/**
 * Spec 0055 — the redemption against a real Neon branch: the happy paths, sequential
 * idempotency and the dispensation.
 *
 * Every assertion is on state READ BACK FROM THE DATABASE, never on the value the API
 * returned: in the bug of ADR 0054 the API answered a balance that did not exist, so
 * the response is not an oracle. Where the spec distinguishes a right balance from a
 * lying log, the assertion is on the `core.reward_redemption` ROW.
 *
 * The concurrency cases live in `counter-redeem-races.neon.integration.test.ts` and the
 * authorization/validation guards in `counter-redeem-guards.neon.integration.test.ts`
 * (split for the file-size budget, not because they are optional).
 */
describe.skipIf(!integrationEnabled)(
  "reward redemption against Neon (spec 0055)",
  () => {
    let world: RedeemWorld;

    beforeAll(async () => {
      world = await seedRedeemWorld("Canje");
    }, 60_000);

    afterAll(async () => {
      await dropRedeemWorld(world);
    }, 60_000);

    it("Puntos: debits the reward cost and logs the whole snapshot", async () => {
      const { points, pointsReward } = world;
      const card = await newCard(points, { points: 100 });
      const input = redeemBody(card, pointsReward, points);
      const result = await redeemReward(points.business, points.userId, input);
      expect(result.redemption).toMatchObject({
        rewardLabel: "Café gratis",
        rewardType: "custom",
        discountPercent: null,
        unitsDebited: COST,
        balanceAfter: 70,
        kind: "points",
        override: false,
      });

      expect((await readBalances(card.membershipId)).points).toBe(70);
      const [row] = await readLog(points.business.id, input.clientRequestId);
      expect(row).toMatchObject({
        rewardId: pointsReward,
        rewardLabel: "Café gratis",
        rewardType: "custom",
        rewardPointsCost: COST,
        accrualKind: "points",
        unitsDebited: COST,
        balanceBefore: 100,
        balanceAfter: 70,
        insufficientOverride: false,
        membershipId: card.membershipId,
        consumerId: card.consumerId,
        createdByUserId: points.userId,
        locationId: points.locationId,
        programId: points.programId,
        businessId: points.business.id,
      });
      // The consumer is notified once, from the outbox row enqueued in the same tx.
      const pushes = await readPushes(card.consumerId);
      expect(pushes).toHaveLength(1);
      expect(pushes[0].body).toContain("Café gratis");
    }, 60_000);

    it("Sellos: consumes the card and LEAVES THE CARRY-OVER (12 on a card of 10 → 2)", async () => {
      const { stamps, stampsReward } = world;
      const card = await newCard(stamps, { stamps: 12 });
      const input = redeemBody(card, stampsReward, stamps);
      const result = await redeemReward(stamps.business, stamps.userId, input);
      expect(result.redemption).toMatchObject({
        unitsDebited: TARGET,
        balanceAfter: 2,
        kind: "stamps",
        override: false,
      });
      expect((await readBalances(card.membershipId)).stamps).toBe(2);
      const [row] = await readLog(stamps.business.id, input.clientRequestId);
      expect(row).toMatchObject({
        accrualKind: "stamps",
        unitsDebited: TARGET,
        balanceBefore: 12,
        balanceAfter: 2,
        // A Sellos reward carries no cost; the table check tolerates it only here.
        rewardPointsCost: null,
        insufficientOverride: false,
      });
    }, 60_000);

    it("a sequential retry with the same clientRequestId debits ONCE (asserted by SQL)", async () => {
      const { points, pointsReward } = world;
      const card = await newCard(points, { points: 100 });
      const input = redeemBody(card, pointsReward, points);
      const first = await redeemReward(points.business, points.userId, input);
      const second = await redeemReward(points.business, points.userId, input);
      expect(first.redemption.balanceAfter).toBe(70);
      expect(second.redemption.balanceAfter).toBe(70);

      expect((await readBalances(card.membershipId)).points).toBe(70);
      expect(
        await readLog(points.business.id, input.clientRequestId),
      ).toHaveLength(1);
      // The retry does NOT re-notify: the push is enqueued inside the transaction and
      // the idempotent path returns before reaching it.
      expect(await readPushes(card.consumerId)).toHaveLength(1);
    }, 60_000);

    it("the dispensation drops the balance to 0 and the log says how much was given away", async () => {
      const { dispensing, dispensingReward } = world;
      const card = await newCard(dispensing, { points: 80 });
      const input = redeemBody(card, dispensingReward, dispensing);
      const result = await redeemReward(
        dispensing.business,
        dispensing.userId,
        input,
      );
      expect(result.redemption).toMatchObject({
        unitsDebited: 80,
        balanceAfter: 0,
        override: true,
      });
      expect((await readBalances(card.membershipId)).points).toBe(0);
      const [row] = await readLog(
        dispensing.business.id,
        input.clientRequestId,
      );
      expect(row).toMatchObject({
        unitsDebited: 80, // what was PAID
        rewardPointsCost: DISPENSED_COST, // what it COST
        balanceBefore: 80,
        balanceAfter: 0,
        insufficientOverride: true,
      });
    }, 60_000);

    it("Sellos with the dispensation: the owner's other example, 9 of 10 → 0", async () => {
      const { dispensingStamps, dispensingStampsReward } = world;
      const card = await newCard(dispensingStamps, { stamps: 9 });
      const input = redeemBody(card, dispensingStampsReward, dispensingStamps);
      await redeemReward(
        dispensingStamps.business,
        dispensingStamps.userId,
        input,
      );
      expect((await readBalances(card.membershipId)).stamps).toBe(0);
      const [row] = await readLog(
        dispensingStamps.business.id,
        input.clientRequestId,
      );
      expect(row).toMatchObject({
        unitsDebited: 9,
        balanceBefore: 9,
        balanceAfter: 0,
        insufficientOverride: true,
      });
    }, 60_000);

    it("without the dispensation, 9 of 10 is blocked and the card is untouched", async () => {
      const { stamps, stampsReward } = world;
      const card = await newCard(stamps, { stamps: 9 });
      const input = redeemBody(card, stampsReward, stamps);
      await expect(
        redeemReward(stamps.business, stamps.userId, input),
      ).rejects.toMatchObject({ status: 422, code: "insufficient_balance" });
      expect((await readBalances(card.membershipId)).stamps).toBe(9);
      expect(
        await readLog(stamps.business.id, input.clientRequestId),
      ).toHaveLength(0);
      // DoD 12 says ZERO effects, and "no push" is one of the three: the outbox row is
      // enqueued inside the same transaction, so a blocked redemption that still queued
      // one would mean the 422 was thrown after the insert (or outside the tx).
      expect(await readPushes(card.consumerId)).toHaveLength(0);
    }, 60_000);

    it("no membership of these programs ended up with a negative balance", async () => {
      const businessIds = [
        world.points.business.id,
        world.stamps.business.id,
        world.dispensing.business.id,
        world.dispensingStamps.business.id,
      ];
      const rows = await getDb()
        .select({ id: programMemberships.id })
        .from(programMemberships)
        .where(
          and(
            sql`${programMemberships.businessId} IN (${sql.join(
              businessIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`,
            or(
              sql`${programMemberships.pointsBalance} < 0`,
              sql`${programMemberships.stampsCount} < 0`,
            ),
          ),
        );
      expect(rows).toHaveLength(0);
    }, 60_000);
  },
);
