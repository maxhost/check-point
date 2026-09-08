import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  readBalances,
} from "./counter-integration-support";
import {
  COST,
  DISPENSED_COST,
  type RedeemWorld,
  dropRedeemWorld,
  newCard,
  readLog,
  readLogByMembership,
  readPushes,
  redeemBody,
  seedRedeemWorld,
  sleep,
} from "./counter-redeem-support";
import { withDbTransaction } from "./db";
import { programMemberships } from "./schema";
import { redeemReward } from "./counter/redeem";
import { grantAccrual } from "./counter/grant";

/**
 * Spec 0055 / ADR 0054 — the redemption under REAL concurrency against Neon.
 *
 * The assertions that carry the weight are on the `core.reward_redemption` ROW, not on
 * the balance: a right balance with a lying log is the false green this spec declares
 * (in the ADR 0054 bug the API reported an intermediate balance while the row said
 * something else). Reading the balance too is necessary but never sufficient.
 *
 * A single pair of requests may not interleave, so the same-key race repeats over fresh
 * cards; the 8-way case and the override case are deterministic by construction.
 */

const RACES = 4;
const CONCURRENCY = 4;

describe.skipIf(!integrationEnabled)(
  "reward redemption under concurrency against Neon (spec 0055)",
  () => {
    let world: RedeemWorld;

    beforeAll(async () => {
      world = await seedRedeemWorld("Carrera");
    }, 60_000);

    afterAll(async () => {
      await dropRedeemWorld(world);
    }, 60_000);

    for (let attempt = 1; attempt <= RACES; attempt += 1) {
      it(`race ${attempt}/${RACES}: ${CONCURRENCY} CONCURRENT redemptions with the SAME clientRequestId debit once`, async () => {
        const { points, pointsReward } = world;
        const card = await newCard(points, { points: 100 });
        const input = redeemBody(card, pointsReward, points);
        const settled = await Promise.allSettled(
          Array.from({ length: CONCURRENCY }, () =>
            redeemReward(points.business, points.userId, input),
          ),
        );
        // The losers are absorbed (idempotent read under the lock, or the 23505
        // backstop followed by a reread), so every caller still gets a 2xx. The lie was
        // never in the status code — hence the assertions below are on the row.
        expect(
          settled
            .filter((r) => r.status === "rejected")
            .map((r) => String(r.reason)),
          `race ${attempt}: unexpected rejections`,
        ).toEqual([]);

        const rows = await readLog(points.business.id, input.clientRequestId);
        expect(rows, `race ${attempt}: log rows`).toHaveLength(1);
        expect(rows[0].unitsDebited, `race ${attempt}: units_debited`).toBe(
          COST,
        );
        expect(rows[0].balanceBefore, `race ${attempt}: balance_before`).toBe(
          100,
        );
        expect(rows[0].balanceAfter, `race ${attempt}: balance_after`).toBe(70);
        expect(
          (await readBalances(card.membershipId)).points,
          `race ${attempt}: points_balance`,
        ).toBe(70);
        expect(
          await readPushes(card.consumerId),
          `race ${attempt}: wallet_push_queue rows`,
        ).toHaveLength(1);
      }, 120_000);
    }

    it("8 concurrent redemptions with balance for ONE leave exactly one redemption", async () => {
      // Eight DIFFERENT idempotency keys: the unique index cannot help here, only the
      // row lock can. Without `FOR UPDATE` all eight read the same balance, all decide
      // "enough", all write the same `balanceAfter` and eight rows land — eight rewards
      // handed over for the price of one, each row claiming `balance_before = 30`.
      const { points, pointsReward } = world;
      const card = await newCard(points, { points: COST });
      const settled = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          redeemReward(
            points.business,
            points.userId,
            redeemBody(card, pointsReward, points, randomUUID()),
          ),
        ),
      );
      const rejected = settled.filter((r) => r.status === "rejected");
      expect(settled.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(rejected).toHaveLength(7);
      for (const failure of rejected) {
        expect(failure.reason).toMatchObject({
          status: 422,
          code: "insufficient_balance",
        });
      }

      const rows = await readLogByMembership(card.membershipId);
      expect(rows, "one redemption row for the whole burst").toHaveLength(1);
      expect(rows[0].unitsDebited).toBe(COST);
      expect(rows[0].balanceBefore).toBe(COST);
      expect(rows[0].balanceAfter).toBe(0);
      expect((await readBalances(card.membershipId)).points).toBe(0);
      expect(await readPushes(card.consumerId)).toHaveLength(1);
    }, 120_000);

    it("with the dispensation ON there is NO cap: 5 concurrent redemptions leave 5 rows of 0 units", async () => {
      // ⚠️ THIS TEST PINS A DELIBERATE OWNER DECISION, NOT A BUG. Spec 0055 §9 + DoD 8:
      // `redeem_allow_insufficient = true` means "hand the reward over anyway, drop the
      // balance to 0, never negative". A cap is exactly what that renounces, and
      // `api/counter/*` has no rate limit, so N concurrent confirmations legitimately
      // produce N redemptions with `units_debited = 0` once the balance hits 0.
      //
      // If you are reading this because it went RED: you are about to revert a product
      // decision, not to fix a defect. Capping the dispensation is another spec (it is
      // listed under «Declarado fuera de alcance por la revisión» in 0055). Until then,
      // this staying green is the evidence that nobody "fixed" it by accident.
      const { dispensing, dispensingReward } = world;
      const card = await newCard(dispensing, { points: 0 });
      const settled = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          redeemReward(
            dispensing.business,
            dispensing.userId,
            // Five DIFFERENT idempotency keys: five genuine confirmations, not retries.
            redeemBody(card, dispensingReward, dispensing, randomUUID()),
          ),
        ),
      );
      expect(
        settled.filter((r) => r.status === "rejected").map((r) => String(r)),
        "no redemption may be rejected: the dispensation renounces the cap",
      ).toEqual([]);

      const rows = await readLogByMembership(card.membershipId);
      expect(rows, "five redemptions, five rows").toHaveLength(5);
      for (const row of rows) {
        // The log is the oracle, not the balance: a courtesy reward is only auditable
        // if the row says it was paid with 0 units and flags the override.
        expect(row.unitsDebited, "units_debited").toBe(0);
        expect(row.insufficientOverride, "insufficient_override").toBe(true);
        expect(row.balanceBefore, "balance_before").toBe(0);
        expect(row.balanceAfter, "balance_after").toBe(0);
        expect(row.rewardPointsCost, "what it COST is still recorded").toBe(
          DISPENSED_COST,
        );
      }
      // …and the balance never went negative on the way (read by SQL, not from the API).
      expect((await readBalances(card.membershipId)).points).toBe(0);
    }, 120_000);

    it("insufficient_override does not lie under concurrency: an accreditation that lands between resolve and confirm is seen", async () => {
      // Deterministic version of the race the spec describes. A transaction OF THE TEST
      // holds the membership row locked at a balance of 20 (not enough for the reward
      // of 100), then raises it to 120 and commits. The redemption blocks on step (1)
      // and can only decide afterwards — over the locked, fresh balance.
      //
      // This is the test that mutation (b) (decide from a pre-read outside the
      // transaction) turns red: the pre-read would see 20, debit 20, drop the card to 0
      // and log `insufficient_override = true` — the consumer paying full price while
      // the log claims the reward was given away, inflating exactly the number the
      // owner asked to audit (ADR 0053 §4).
      const { dispensing, dispensingReward } = world;
      const card = await newCard(dispensing, { points: 20 });
      const input = redeemBody(card, dispensingReward, dispensing);

      const gate = withDbTransaction(async (tx) => {
        await tx
          .select({ id: programMemberships.id })
          .from(programMemberships)
          .where(eq(programMemberships.id, card.membershipId))
          .for("update");
        await sleep(1_500);
        await tx
          .update(programMemberships)
          .set({ pointsBalance: 120 })
          .where(eq(programMemberships.id, card.membershipId));
      });
      await sleep(400); // let the gate take the lock before the redemption asks for it
      const redeeming = redeemReward(
        dispensing.business,
        dispensing.userId,
        input,
      );
      await gate;
      const result = await redeeming;

      const [row] = await readLog(
        dispensing.business.id,
        input.clientRequestId,
      );
      expect(row.insufficientOverride, "insufficient_override").toBe(false);
      expect(row.unitsDebited, "units_debited").toBe(DISPENSED_COST);
      expect(row.balanceBefore, "balance_before").toBe(120);
      expect(row.balanceAfter, "balance_after").toBe(20);
      expect((await readBalances(card.membershipId)).points).toBe(20);
      expect(result.redemption.override).toBe(false);
    }, 120_000);

    it("a redemption concurrent with an accreditation of the same card keeps both", async () => {
      // The reverse direction: the grant path (spec 0056, neon-http single statement)
      // and the redemption (interactive transaction) touch the same row. Neither may
      // lose the other's write: 100 → +20 → -30 must land on 90, whatever the order.
      const { points, pointsReward } = world;
      const card = await newCard(points, { points: 100 });
      const input = redeemBody(card, pointsReward, points);
      await Promise.all([
        redeemReward(points.business, points.userId, input),
        grantAccrual(points.business, points.userId, {
          clientRequestId: randomUUID(),
          membershipId: card.membershipId,
          mode: "quick",
          total: "6.00", // 10 pts each $3 → +20
        }),
      ]);
      expect((await readBalances(card.membershipId)).points).toBe(90);
      const [row] = await readLog(points.business.id, input.clientRequestId);
      // Whichever went first, the log describes what the card really had at that moment.
      expect([100, 120]).toContain(row.balanceBefore);
      expect(row.balanceAfter).toBe(row.balanceBefore - COST);
      expect(row.insufficientOverride).toBe(false);
    }, 120_000);
  },
);
