/**
 * The redemption decision as a PURE function (spec 0055, contract fixed in
 * `docs/specs/0055-contratos-del-orquestador.md` §2). No DB, no server imports.
 *
 * It is the DECIDER, not a parallel arithmetic: `counter/redemptions.ts` writes
 * `balanceAfter` LITERALLY into `consumer.program_membership` inside the interactive
 * transaction that holds the row lock — there is no `GREATEST` and no `saldo - costo`
 * in SQL that could disagree with it (ADR 0054 §2).
 *
 * **What extracting this does NOT cover, declared instead of papered over (lesson of
 * task 38):** that the caller invokes it with the LOCKED balance and with the reward the
 * operator actually chose. No unit test and no static sweep can pin that down — it is
 * covered by the Neon integration (`insufficient_override` under concurrency, and the
 * redemption ‖ accreditation race).
 */

export type RedeemPlanInput = {
  kind: "points" | "stamps";
  /** The LOCKED balance (points_balance or stamps_count), read with FOR UPDATE. */
  balance: number;
  /** The RAW `configuration.target` of the program (jsonb). Only read for Sellos. */
  target: unknown;
  /** Only `pointsCost` is read, and only for Puntos. */
  reward: { pointsCost: number | null };
  allowInsufficient: boolean;
};

export type RedeemPlan =
  | { unitsToDebit: number; balanceAfter: number; override: boolean }
  | { error: "invalid_reward" | "invalid_program" | "insufficient_balance" };

/**
 * Evaluation order is NORMATIVE — changing it changes which error the operator sees:
 *
 *  1. `balance` must be a non-negative integer, else `invalid_program`. (Defensive: the
 *     DB check `>= 0` makes it unreachable through the real path. Declared, not omitted.)
 *  2. The required cost, by kind:
 *     - `points` → `reward.pointsCost`, integer `>= 1`, else `invalid_reward`
 *       (`points_cost` is nullable in the DB and its check only says `IS NULL OR > 0`).
 *     - `stamps` → `Number(target)`, integer `>= 1`, else `invalid_program`.
 *       `null` / `""` / `false` / `{}` / `NaN` / `0` / `1.5` / negatives are ALL errors:
 *       `Number(null) === 0` is the exact trap that would make `stamps >= 0` always true
 *       and turn every scan into a free, unlimited redemption with `units_debited = 0`.
 *  3. Enough balance → debit the full cost, carry over the rest (12 stamps on a card of
 *     10 → debit 10, 2 remain).
 *  4. Not enough and the program does not dispense → `insufficient_balance`.
 *  5. Not enough and the program DOES dispense (§9) → debit whatever there is, balance
 *     falls to 0 (never negative) and `override` marks that THIS operation used the
 *     dispensation — it is not "the program allows it", it is the audited fact.
 */
export function planRedemption(input: RedeemPlanInput): RedeemPlan {
  if (!Number.isInteger(input.balance) || input.balance < 0) {
    return { error: "invalid_program" };
  }
  const required =
    input.kind === "points"
      ? requiredPointsCost(input.reward.pointsCost)
      : requiredStampsTarget(input.target);
  if (typeof required !== "number") return required;

  if (input.balance >= required) {
    return {
      unitsToDebit: required,
      balanceAfter: input.balance - required,
      override: false,
    };
  }
  if (!input.allowInsufficient) return { error: "insufficient_balance" };
  return { unitsToDebit: input.balance, balanceAfter: 0, override: true };
}

/** Puntos: the reward's own cost. A reward without one is a broken reward, and the
 * dispensation never covers it up (cases 6 and 7 of the contract table). */
function requiredPointsCost(
  pointsCost: number | null,
): number | { error: "invalid_reward" } {
  if (!Number.isInteger(pointsCost) || (pointsCost as number) < 1) {
    return { error: "invalid_reward" };
  }
  return pointsCost as number;
}

/** Sellos: the card size, read raw from `configuration.target` (jsonb). A numeric
 * string is accepted (`Number("10") === 10`, same as `consumer/programs.ts`); anything
 * that does not land on an integer `>= 1` is a broken PROGRAM, never a free redemption. */
function requiredStampsTarget(
  target: unknown,
): number | { error: "invalid_program" } {
  if (typeof target !== "number" && typeof target !== "string") {
    return { error: "invalid_program" };
  }
  const parsed = Number(target);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { error: "invalid_program" };
  }
  return parsed;
}
