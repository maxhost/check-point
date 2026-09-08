import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  readBalances,
  seedBusiness,
  seedMember,
  seedReward,
} from "./counter-integration-support";
import {
  COST,
  type RedeemWorld,
  dropRedeemWorld,
  newCard,
  readLog,
  readLogByMembership,
  readPushes,
  redeemBody,
  seedRedeemWorld,
} from "./counter-redeem-support";
import { getDb } from "./db";
import { loyaltyPrograms, loyaltyRewards } from "./schema";
import { operatorBusiness } from "./counter/core";
import { redeemReward } from "./counter/redeem";
import { saveProgram } from "./loyalty-program";

/**
 * Spec 0055 — authorization, validation and history guards of the redemption, against
 * a real Neon branch. Every error is asserted by its NAMED code: the spec forbids
 * classifying by elimination, and forbids `insufficient_balance` from being the landing
 * place of anything unexpected.
 */
describe.skipIf(!integrationEnabled)(
  "reward redemption guards against Neon (spec 0055)",
  () => {
    let world: RedeemWorld;

    beforeAll(async () => {
      world = await seedRedeemWorld("Guardas");
    }, 60_000);

    afterAll(async () => {
      await dropRedeemWorld(world);
    }, 60_000);

    it("a disabled member cannot operate the counter at all (ADR 0044)", async () => {
      const businessId = world.points.business.id;
      const active = await seedMember({ businessId, role: "staff" });
      const disabled = await seedMember({
        businessId,
        role: "staff",
        status: "disabled",
      });
      // Anti-false-green: the active staff DOES resolve, so a null for the disabled one
      // is the `status` filter and not a typo/missing seed.
      expect(await operatorBusiness(active)).toMatchObject({ id: businessId });
      expect(await operatorBusiness(disabled)).toBeNull();
    }, 60_000);

    it("an operator of another business cannot redeem against this card (403)", async () => {
      // The reward must be a VALID one of the operator's own program, otherwise the
      // reward lookup answers 422 `unknown_reward` first and the membership scoping is
      // never exercised. What is under test here is the `SELECT … FOR UPDATE` scoped to
      // the operator's business: a card of another business simply is not there.
      const card = await newCard(world.points, { points: 100 });
      await expect(
        redeemReward(
          world.dispensing.business, // another business entirely
          world.dispensing.userId,
          redeemBody(card, world.dispensingReward, world.dispensing),
        ),
      ).rejects.toMatchObject({ status: 403, code: "foreign_membership" });
      expect((await readBalances(card.membershipId)).points).toBe(100);
      expect(await readLogByMembership(card.membershipId)).toHaveLength(0);
    }, 60_000);

    it("a reward of another program is 422 unknown_reward, never a redemption", async () => {
      const card = await newCard(world.points, { points: 100 });
      await expect(
        redeemReward(
          world.points.business,
          world.points.userId,
          // `dispensingReward` belongs to another program (and another business).
          redeemBody(card, world.dispensingReward, world.points),
        ),
      ).rejects.toMatchObject({ status: 422, code: "unknown_reward" });
      expect((await readBalances(card.membershipId)).points).toBe(100);
      expect(await readLogByMembership(card.membershipId)).toHaveLength(0);
    }, 60_000);

    it("the same clientRequestId with a DIFFERENT rewardId is 409, without debiting", async () => {
      const other = await seedReward({
        programId: world.points.programId,
        businessId: world.points.business.id,
        label: "Medialuna",
        pointsCost: 10,
        position: 1,
      });
      const card = await newCard(world.points, { points: 100 });
      const key = randomUUID();
      await redeemReward(
        world.points.business,
        world.points.userId,
        redeemBody(card, world.pointsReward, world.points, key),
      );
      await expect(
        redeemReward(
          world.points.business,
          world.points.userId,
          redeemBody(card, other, world.points, key),
        ),
      ).rejects.toMatchObject({ status: 409, code: "request_id_reused" });
      // Only the first redemption exists and only its cost was debited.
      expect((await readBalances(card.membershipId)).points).toBe(100 - COST);
      const rows = await readLogByMembership(card.membershipId);
      expect(rows).toHaveLength(1);
      expect(rows[0].rewardId).toBe(world.pointsReward);
      expect(await readPushes(card.consumerId)).toHaveLength(1);
    }, 60_000);

    it("a Puntos reward with a NULL points_cost is 422 invalid_reward, balance intact", async () => {
      // The shape is representable: `loyalty_reward.points_cost` is nullable and its
      // check only says `IS NULL OR > 0`. In the discarded single-statement design
      // `GREATEST(x - NULL, 0)` returned 0 and WIPED the whole balance.
      const broken = await seedReward({
        programId: world.points.programId,
        businessId: world.points.business.id,
        label: "Premio roto",
        pointsCost: null,
        position: 2,
      });
      const card = await newCard(world.points, { points: 100 });
      await expect(
        redeemReward(
          world.points.business,
          world.points.userId,
          redeemBody(card, broken, world.points),
        ),
      ).rejects.toMatchObject({ status: 422, code: "invalid_reward" });
      expect((await readBalances(card.membershipId)).points).toBe(100);
      expect(await readLogByMembership(card.membershipId)).toHaveLength(0);
      expect(await readPushes(card.consumerId)).toHaveLength(0);
    }, 60_000);

    it("a Sellos program with an absent or 0 target is 422 invalid_program, never a free redemption", async () => {
      // `Number(undefined)` is NaN and `Number(null)` is 0 — with a `>= 0` guard, a
      // target of 0 would be an unlimited free redemption with `units_debited = 0`.
      for (const configuration of [{}, { unitName: "sellos", target: 0 }]) {
        const seed = await seedBusiness({
          name: `Sellos rotos ${randomUUID().slice(0, 8)}`,
          kind: "stamps",
          mode: "per_purchase",
          grant: 1,
          blockAmount: null,
          configuration,
        });
        try {
          const reward = await seedReward({
            programId: seed.programId,
            businessId: seed.business.id,
            label: "Gratis",
            pointsCost: null,
          });
          const card = await newCard(seed, { stamps: 5 });
          await expect(
            redeemReward(
              seed.business,
              seed.userId,
              redeemBody(card, reward, seed),
            ),
          ).rejects.toMatchObject({ status: 422, code: "invalid_program" });
          expect((await readBalances(card.membershipId)).stamps).toBe(5);
          expect(await readLogByMembership(card.membershipId)).toHaveLength(0);
        } finally {
          await dropBusiness(seed.business.id);
        }
      }
    }, 120_000);

    it("the log survives saveProgram rewriting the rewards: reward_id NULL, snapshot intact", async () => {
      const seed = await seedBusiness({
        name: `Snapshot ${randomUUID().slice(0, 8)}`,
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "3.00",
        configuration: { unitSingular: "punto", unitPlural: "puntos" },
      });
      try {
        const reward = await seedReward({
          programId: seed.programId,
          businessId: seed.business.id,
          label: "Café gratis",
          pointsCost: COST,
        });
        const card = await newCard(seed, { points: 100 });
        const input = redeemBody(card, reward, seed);
        await redeemReward(seed.business, seed.userId, input);

        // The REAL `saveProgram`: it deletes every reward of the program and re-inserts
        // them on every save, which is why the id is not stable and the log snapshots.
        await saveProgram(seed.userId, {
          kind: "points",
          configuration: { unitSingular: "punto", unitPlural: "puntos" },
          clauses: [{ text: "Términos del programa." }],
          accrual: { mode: "per_amount", grant: 10, blockAmount: 3 },
          rewards: [{ type: "custom", label: "Otro premio", pointsCost: 99 }],
          redeemAllowInsufficient: true,
        });
        expect(
          await getDb()
            .select({ id: loyaltyRewards.id })
            .from(loyaltyRewards)
            .where(eq(loyaltyRewards.id, reward)),
        ).toHaveLength(0);

        const [row] = await readLog(seed.business.id, input.clientRequestId);
        expect(row.rewardId, "the FK is best-effort and goes NULL").toBeNull();
        expect(row.rewardLabel, "the snapshot is the source of truth").toBe(
          "Café gratis",
        );
        expect(row.rewardPointsCost).toBe(COST);
        expect(row.unitsDebited).toBe(COST);
        expect(row.balanceAfter).toBe(70);

        // Same save proves the UPDATE path writes `redeem_allow_insufficient`.
        const [program] = await getDb()
          .select({ flag: loyaltyPrograms.redeemAllowInsufficient })
          .from(loyaltyPrograms)
          .where(eq(loyaltyPrograms.id, seed.programId));
        expect(program.flag).toBe(true);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 120_000);

    it("saveProgram writes redeem_allow_insufficient on the INSERT path too", async () => {
      // The spec calls out both writes explicitly: the guarded UPDATE and the INSERT.
      // A flag written in only one of them is silently false for every new program.
      const owner: Seed = await seedBusiness({
        name: `Flag insert ${randomUUID().slice(0, 8)}`,
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "3.00",
      });
      try {
        // Drop the seeded program so `saveProgram` takes the creation branch.
        await getDb()
          .delete(loyaltyPrograms)
          .where(eq(loyaltyPrograms.id, owner.programId));
        const created = await saveProgram(owner.userId, {
          kind: "points",
          configuration: { unitSingular: "punto", unitPlural: "puntos" },
          clauses: [{ text: "Términos del programa." }],
          accrual: { mode: "per_amount", grant: 10, blockAmount: 3 },
          rewards: [{ type: "custom", label: "Café", pointsCost: 50 }],
          redeemAllowInsufficient: true,
        });
        expect(created.created).toBe(true);
        const [program] = await getDb()
          .select({ flag: loyaltyPrograms.redeemAllowInsufficient })
          .from(loyaltyPrograms)
          .where(eq(loyaltyPrograms.id, created.programId));
        expect(program.flag).toBe(true);
      } finally {
        await dropBusiness(owner.business.id);
      }
    }, 120_000);
  },
);
