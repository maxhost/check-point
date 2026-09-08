import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { loyaltyRewards } from "../schema";
import { dispatchGranted } from "../wallet/push";
import {
  CounterError,
  type OperatorBusiness,
  assertLocationInBusiness,
  parseUuid,
  pgErrorCode,
  rawTarget,
} from "./core";
import { accreditableProgram } from "./resolve";
import {
  type PersistedRedemption,
  type RedemptionReward,
  assertSameReward,
  persistRedemption,
  readRedemptionByRequest,
} from "./redemptions";

export type RedeemResult = {
  redemption: {
    rewardLabel: string;
    rewardType: string;
    discountPercent: number | null;
    unitsDebited: number;
    balanceAfter: number;
    kind: string;
    override: boolean;
  };
};

/**
 * The reward the operator chose, scoped to BOTH the redeemable program and the
 * operator's business. A reward of another program (or rewritten away by a
 * `saveProgram` between the scan and the confirmation) is a named `422 unknown_reward`,
 * never a fallthrough into some other error.
 */
async function loadRewardInProgram(
  rewardId: string,
  programId: string,
  businessId: string,
): Promise<RedemptionReward> {
  const [row] = await getDb()
    .select({
      id: loyaltyRewards.id,
      type: loyaltyRewards.rewardType,
      label: loyaltyRewards.label,
      discountPercent: loyaltyRewards.discountPercent,
      pointsCost: loyaltyRewards.pointsCost,
    })
    .from(loyaltyRewards)
    .where(
      and(
        eq(loyaltyRewards.id, rewardId),
        eq(loyaltyRewards.programId, programId),
        eq(loyaltyRewards.businessId, businessId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new CounterError(
      422,
      "unknown_reward",
      "Ese premio ya no está disponible. Volvé a escanear.",
    );
  }
  return row;
}

/** Response allow-list: the reward snapshot, what was debited and the resulting
 * balance. No membership/consumer id, no token, no internal object key. */
function toResult(redemption: PersistedRedemption): RedeemResult {
  return {
    redemption: {
      rewardLabel: redemption.rewardLabel,
      rewardType: redemption.rewardType,
      discountPercent: redemption.rewardDiscountPercent,
      unitsDebited: redemption.unitsDebited,
      balanceAfter: redemption.balanceAfter,
      kind: redemption.accrualKind,
      override: redemption.insufficientOverride,
    },
  };
}

/**
 * Validates and executes a redemption (spec 0055): parses the body, resolves the
 * business's redeemable program (the same `accreditableProgram` — `active` AND
 * `closing`, because closing is exactly the window in which a consumer burns their
 * balance), resolves the chosen reward inside that program, and hands everything to the
 * interactive transaction that holds the membership lock.
 *
 * **Every error is classified explicitly, never by elimination.** An unexpected
 * exception (deadlock, `statement_timeout`, a dropped connection) is rethrown as-is and
 * lands on `counterError`'s `503`; it is never re-labelled `insufficient_balance`.
 */
export async function redeemReward(
  business: OperatorBusiness,
  operatorUserId: string,
  raw: Record<string, unknown>,
): Promise<RedeemResult> {
  const clientRequestId = parseUuid(raw.clientRequestId, "clientRequestId");
  const membershipId = parseUuid(raw.membershipId, "membershipId");
  const rewardId = parseUuid(raw.rewardId, "rewardId");
  const locationId =
    raw.locationId === null ||
    raw.locationId === undefined ||
    raw.locationId === ""
      ? null
      : await assertLocationInBusiness(
          business.id,
          parseUuid(raw.locationId, "locationId"),
        );

  const program = await accreditableProgram(business.id);
  const programKind = program.kind === "stamps" ? "stamps" : "points";
  const reward = await loadRewardInProgram(rewardId, program.id, business.id);

  let redemption: PersistedRedemption;
  try {
    redemption = await persistRedemption({
      businessId: business.id,
      locationId,
      programId: program.id,
      programKind,
      target: rawTarget(program),
      allowInsufficient: program.redeemAllowInsufficient,
      membershipId,
      reward,
      createdByUserId: operatorUserId,
      clientRequestId,
    });
  } catch (error) {
    // Only the idempotency backstop is absorbed: another transaction inserted this
    // `(business_id, client_request_id)` first, so this one aborted and debited nothing.
    if (pgErrorCode(error) !== "23505") throw error;
    const existing = await readRedemptionByRequest(
      business.id,
      clientRequestId,
    );
    if (!existing) {
      throw new CounterError(
        503,
        "redeem_failed",
        "No pudimos canjear. Probá de nuevo.",
      );
    }
    assertSameReward(existing, rewardId);
    redemption = existing;
  }

  // Best-effort inline dispatch of the transactional push (ADR 0037); only fires when
  // THIS call created the redemption — a retry/reread carries no `pushQueueId`.
  dispatchGranted(redemption.pushQueueId);

  return toResult(redemption);
}
