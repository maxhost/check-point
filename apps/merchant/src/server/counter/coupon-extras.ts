import { and, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { loyaltyPrograms, programMemberships } from "@mi-pasaporte/db/schema";
import { CounterError } from "./core";

/**
 * THE EXTRA STAMPS / POINTS OF A CAMPAIGN COUPON (spec 0106 / ADR 0098 §6): the one coupon
 * that credits the program. Credited when the coupon is REDEEMED at the counter (not when it
 * is issued), and it is NOT a visit: no `core."order"` is created — what was credited stays
 * on the `coupon_redemption` row (`units_granted`, `balance_after`).
 *
 * Called by `persistCouponRedemption` INSIDE its transaction, AFTER the campaign/coupon locks
 * and `decideCouponRedemption`, and BEFORE the redemption insert: if the insert aborts (a
 * `23505` of the idempotency backstop), the credit rolls back with it — so a coupon credits
 * ONCE. Crediting in another transaction, or before the locks, is how two concurrent
 * redemptions of one coupon would credit twice (`counter-coupon-races`).
 */

export type ExtraKind = "extra_stamps" | "extra_points";

export type ExtraDecision =
  | { ok: true; column: "stamps" | "points"; balanceAfter: number }
  | { ok: false };

export const PROGRAM_CHANGED =
  "El programa de fidelidad cambió: este cupón ya no se puede canjear.";

/**
 * PURE. The coupon's unit must still be the program's: the program has to be operational
 * (`active`/`closing`), of the coupon's kind, and the membership has to belong to it.
 * Otherwise nothing is credited and the coupon stays unredeemed (ADR 0098 §6) — if the
 * program comes back to that unit, the same coupon redeems.
 */
export function decideExtraGrant(facts: {
  kind: ExtraKind;
  units: number;
  membership: { programId: string; stampsCount: number; pointsBalance: number };
  program: { id: string; status: string; kind: string } | null;
}): ExtraDecision {
  const { program, membership } = facts;
  const unit = facts.kind === "extra_stamps" ? "stamps" : "points";
  if (
    !program ||
    (program.status !== "active" && program.status !== "closing") ||
    program.kind !== unit ||
    membership.programId !== program.id
  )
    return { ok: false };
  const before =
    unit === "stamps" ? membership.stampsCount : membership.pointsBalance;
  return { ok: true, column: unit, balanceAfter: before + facts.units };
}

export type ExtraGrant = { unitsGranted: number; balanceAfter: number };

/**
 * Locks the coupon's membership and the business's OPERATIONAL program (`FOR UPDATE`, in that
 * order — the card first, like every balance writer; at most one operational program exists,
 * `core_loyalty_program_one_operational`), decides, and writes exactly the decided balance.
 * Reading the operational program — not the membership's own — is what makes «the membership
 * belongs to another program» a real case: a closed program replaced by a new one.
 * `null` for a coupon that is not `extra_*`: nothing is read or written.
 */
export async function grantCouponExtras(
  tx: DbTransaction,
  coupon: {
    businessId: string;
    membershipId: string;
    kindSnapshot: string;
    extraUnitsSnapshot: number | null;
  },
): Promise<ExtraGrant | null> {
  const kind = coupon.kindSnapshot;
  if (kind !== "extra_stamps" && kind !== "extra_points") return null;
  const units = coupon.extraUnitsSnapshot ?? 0;
  const [membership] = await tx
    .select({
      programId: programMemberships.programId,
      stampsCount: programMemberships.stampsCount,
      pointsBalance: programMemberships.pointsBalance,
    })
    .from(programMemberships)
    .where(
      and(
        eq(programMemberships.id, coupon.membershipId),
        eq(programMemberships.businessId, coupon.businessId),
      ),
    )
    .limit(1)
    .for("update");
  const [program] = membership
    ? await tx
        .select({
          id: loyaltyPrograms.id,
          status: loyaltyPrograms.status,
          kind: loyaltyPrograms.kind,
        })
        .from(loyaltyPrograms)
        .where(
          and(
            eq(loyaltyPrograms.businessId, coupon.businessId),
            inArray(loyaltyPrograms.status, ["active", "closing"]),
          ),
        )
        .limit(1)
        .for("update")
    : [];
  const decision = membership
    ? decideExtraGrant({ kind, units, membership, program: program ?? null })
    : ({ ok: false } as const);
  if (!decision.ok)
    throw new CounterError(409, "program_changed", PROGRAM_CHANGED);
  await tx
    .update(programMemberships)
    .set(
      decision.column === "stamps"
        ? { stampsCount: decision.balanceAfter }
        : { pointsBalance: decision.balanceAfter },
    )
    .where(eq(programMemberships.id, coupon.membershipId));
  return { unitsGranted: units, balanceAfter: decision.balanceAfter };
}
