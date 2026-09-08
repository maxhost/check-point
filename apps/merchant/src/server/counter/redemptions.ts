import { and, eq } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "../db";
import {
  businesses,
  programMemberships,
  rewardRedemptions,
  walletPushQueue,
} from "../schema";
import { buildRedemptionBody } from "../wallet/push";
import { CounterError } from "./core";
import { planRedemption } from "./redeem-plan";

export type RedemptionReward = {
  id: string;
  type: string;
  label: string;
  discountPercent: number | null;
  pointsCost: number | null;
};

export type PersistRedemptionInput = {
  businessId: string;
  locationId: string | null;
  programId: string;
  programKind: "points" | "stamps";
  /** Raw `configuration.target` of the program (jsonb); only read for Sellos. */
  target: unknown;
  allowInsufficient: boolean;
  membershipId: string;
  reward: RedemptionReward;
  createdByUserId: string;
  clientRequestId: string;
};

export type PersistedRedemption = {
  id: string;
  rewardId: string | null;
  rewardType: string;
  rewardLabel: string;
  rewardDiscountPercent: number | null;
  unitsDebited: number;
  balanceAfter: number;
  accrualKind: string;
  insufficientOverride: boolean;
  /** The `wallet_push_queue` row enqueued in the SAME transaction; null on the
   * idempotent-retry / reread path, so a retry never re-notifies the consumer. */
  pushQueueId: string | null;
};

/** Allow-list of the log columns the caller may see. Never selects the whole row. */
const redemptionColumns = {
  id: rewardRedemptions.id,
  rewardId: rewardRedemptions.rewardId,
  rewardType: rewardRedemptions.rewardType,
  rewardLabel: rewardRedemptions.rewardLabel,
  rewardDiscountPercent: rewardRedemptions.rewardDiscountPercent,
  unitsDebited: rewardRedemptions.unitsDebited,
  balanceAfter: rewardRedemptions.balanceAfter,
  accrualKind: rewardRedemptions.accrualKind,
  insufficientOverride: rewardRedemptions.insufficientOverride,
};

const MESSAGES: Record<string, string> = {
  invalid_reward: "Este premio no tiene un costo válido para canjear.",
  invalid_program: "El programa no tiene un objetivo válido para canjear.",
  insufficient_balance: "El saldo no alcanza para este premio.",
};

/**
 * Executes the redemption (spec 0055) as an INTERACTIVE TRANSACTION, the pattern ADR
 * 0054 §2 fixes for every flow that mutates a balance. It deliberately does NOT copy
 * `persistGrant`'s single-statement CTE shape: that idempotency rests on Postgres
 * re-evaluating an uncorrelated `NOT EXISTS` under EvalPlanQual, which it does not do
 * (it is planned as `InitPlan` + `One-Time Filter`, evaluated once, BEFORE the lock) —
 * verified by execution, and in the redemption the same bug would DESTROY balance.
 *
 *  1. `SELECT … FOR UPDATE` on the membership. This serializes every redemption of this
 *     card. Scoped to the operator's business, so a foreign/unknown membership is a
 *     named 403 and never falls through to some other error.
 *  2. With the lock held, idempotency is a plain read: a concurrent redemption with this
 *     `client_request_id` either already committed (it made us wait) or has not started
 *     (it waits for us). Nothing here depends on a property of the planner.
 *  3. Decide with the PURE function, over the locked, fresh balance. `balance_before`
 *     and `insufficient_override` therefore describe what actually happened — computed
 *     from a pre-read, a concurrent accreditation would make the consumer pay full price
 *     while the log claimed the reward was given away (ADR 0053 §4).
 *  4. Write exactly what the pure function decided: `SET <col> = plan.balanceAfter`.
 *     No `GREATEST`, no `balance - cost`; there is no arithmetic in SQL that could
 *     disagree with the unit-tested decision. The DB checks `>= 0` stay as a NET.
 *  5. The push is enqueued INSIDE the transaction (outbox, ADR 0037): a rollback leaves
 *     no push row, and the idempotent retry returns at (2) without enqueuing anything.
 *
 * `unique (business_id, client_request_id)` remains the BACKSTOP (ADR 0054 §3), not the
 * mechanism: two DIFFERENT memberships reusing one key lock different rows, so both
 * reach the insert and the loser's `23505` aborts its transaction — `redeem.ts` catches
 * it and rereads via {@link readRedemptionByRequest}.
 *
 * **Which guard actually covers which case — measured by mutation, not by reading this
 * file.** For the SAME `client_request_id` on the SAME membership, the unique index ALONE
 * is already sufficient: removing the `FOR UPDATE` leaves that race GREEN, because the
 * loser's `23505` aborts and ROLLS BACK its balance `UPDATE` (there is no
 * `ON CONFLICT DO NOTHING` — that is precisely the difference from the ADR 0054 bug).
 * What the lock is load-bearing for is EVERY OTHER concurrent redemption of the same card,
 * where there is no unique key to collide on: without it, 8 concurrent redemptions with
 * balance for one produce EIGHT redemptions instead of one, and `insufficient_override`
 * starts lying. Its oracle is the 8-way test, NOT the same-`clientRequestId` race whose
 * name suggests otherwise (spec 0055, «Plan de pruebas», corrected 2026-09-08).
 */
export async function persistRedemption(
  input: PersistRedemptionInput,
): Promise<PersistedRedemption> {
  return withDbTransaction(async (tx) => {
    // (1) Lock the card.
    const [membership] = await tx
      .select({
        id: programMemberships.id,
        consumerId: programMemberships.consumerId,
        programId: programMemberships.programId,
        pointsBalance: programMemberships.pointsBalance,
        stampsCount: programMemberships.stampsCount,
      })
      .from(programMemberships)
      .where(
        and(
          eq(programMemberships.id, input.membershipId),
          eq(programMemberships.businessId, input.businessId),
        ),
      )
      .limit(1)
      .for("update");
    if (!membership) {
      throw new CounterError(
        403,
        "foreign_membership",
        "Esta membresía no pertenece a tu negocio.",
      );
    }
    if (membership.programId !== input.programId) {
      throw new CounterError(
        404,
        "no_program",
        "El programa de esta membresía ya no canjea.",
      );
    }

    // (2) Idempotency, under the lock.
    const previous = await readRedemptionInTx(
      tx,
      input.businessId,
      input.clientRequestId,
    );
    if (previous) {
      assertSameReward(previous, input.reward.id);
      return { ...previous, pushQueueId: null };
    }

    // (3) Decide over the LOCKED balance.
    const balanceBefore =
      input.programKind === "points"
        ? membership.pointsBalance
        : membership.stampsCount;
    const plan = planRedemption({
      kind: input.programKind,
      balance: balanceBefore,
      target: input.target,
      reward: { pointsCost: input.reward.pointsCost },
      allowInsufficient: input.allowInsufficient,
    });
    if ("error" in plan) {
      throw new CounterError(422, plan.error, MESSAGES[plan.error]);
    }

    // (4) Write literally what the pure function decided.
    await tx
      .update(programMemberships)
      .set(
        input.programKind === "points"
          ? { pointsBalance: plan.balanceAfter }
          : { stampsCount: plan.balanceAfter },
      )
      .where(eq(programMemberships.id, input.membershipId));

    const [row] = await tx
      .insert(rewardRedemptions)
      .values({
        businessId: input.businessId,
        locationId: input.locationId,
        programId: input.programId,
        membershipId: input.membershipId,
        consumerId: membership.consumerId,
        rewardId: input.reward.id,
        rewardType: input.reward.type,
        rewardLabel: input.reward.label,
        rewardDiscountPercent: input.reward.discountPercent,
        rewardPointsCost: input.reward.pointsCost,
        accrualKind: input.programKind,
        unitsDebited: plan.unitsToDebit,
        balanceBefore,
        balanceAfter: plan.balanceAfter,
        insufficientOverride: plan.override,
        createdByUserId: input.createdByUserId,
        clientRequestId: input.clientRequestId,
      })
      .returning(redemptionColumns);

    // (5) Outbox push, same transaction.
    const [business] = await tx
      .select({ name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, input.businessId))
      .limit(1);
    const [push] = await tx
      .insert(walletPushQueue)
      .values({
        consumerId: membership.consumerId,
        class: "transactional",
        title: business?.name ?? "CheckPass Club",
        body: buildRedemptionBody(
          input.reward.label,
          input.programKind,
          plan.balanceAfter,
        ),
        status: "pending",
      })
      .returning({ id: walletPushQueue.id });

    return { ...row, pushQueueId: push.id };
  });
}

/** A retry may only return the redemption it asked for. `reward_id` goes NULL when
 * `saveProgram` rewrites the program's rewards, so a retry that crosses a save cannot
 * be verified and is refused too — safe (no debit) rather than answering with a reward
 * the operator may not have chosen. */
export function assertSameReward(
  previous: { rewardId: string | null },
  rewardId: string,
): void {
  if (previous.rewardId !== rewardId) {
    throw new CounterError(
      409,
      "request_id_reused",
      "Ese identificador ya se usó para canjear otro premio.",
    );
  }
}

async function readRedemptionInTx(
  tx: DbTransaction,
  businessId: string,
  clientRequestId: string,
) {
  const [row] = await tx
    .select(redemptionColumns)
    .from(rewardRedemptions)
    .where(
      and(
        eq(rewardRedemptions.businessId, businessId),
        eq(rewardRedemptions.clientRequestId, clientRequestId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Rereads a redemption by its idempotency key — the `23505` / concurrent-loser path.
 * Returns it with `pushQueueId: null` so the caller never re-dispatches a push. */
export async function readRedemptionByRequest(
  businessId: string,
  clientRequestId: string,
): Promise<PersistedRedemption | null> {
  const [row] = await getDb()
    .select(redemptionColumns)
    .from(rewardRedemptions)
    .where(
      and(
        eq(rewardRedemptions.businessId, businessId),
        eq(rewardRedemptions.clientRequestId, clientRequestId),
      ),
    )
    .limit(1);
  return row ? { ...row, pushQueueId: null } : null;
}
