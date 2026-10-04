import { type SQL, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
import { type LockedCoupon, createdToday } from "./coupon-locks";
import {
  type ExtraFacts,
  type VerdictFacts,
  decideCouponVerdict,
} from "./coupon-decision";

/**
 * THE FACTS OF THE VERDICT, read by ONE query that both readers run (spec 0153): the
 * counter's `couponState` (`coupon-state.ts`, `getDb()`, no locks — a snapshot for painting)
 * and the sale (`grant-coupon.ts`, its interactive transaction, under the three locks of
 * `coupon-locks.ts`). One query for both is what keeps «what is painted green» and «what the
 * sale accepts» from drifting apart: the decision is `decideCouponVerdict` (pure), the facts
 * are these.
 *
 * Raw SQL with explicit aliases (the correlated-subquery gotcha). `count(*)::int`: a bare
 * `count(*)` is a bigint the driver hands over as a string.
 */

export type VerdictCoupon = {
  id: string;
  campaignId: string;
  kindSnapshot: string;
  extraUnitsSnapshot: number | null;
  validFrom: Date;
  validUntil: Date;
};

export type VerdictFactsRow = {
  timezone: string;
  cap: number | null;
  redeemed_count: number;
  redeemed: boolean;
  used_today: boolean;
  m_program_id: string | null;
  m_stamps: number | null;
  m_points: number | null;
  p_id: string | null;
  p_status: string | null;
  p_kind: string | null;
};

/**
 * `membershipId`: the card an `extra_*` coupon credits — the coupon's own, else the scanned
 * one (spec 0136: a cross coupon of a non-member). `null` (the counter's poll does not name
 * one for a coupon without its own card) → the consumer's card in the business's
 * operational program, which is the only one the sale can name (`grant.ts`, `no_program`).
 */
export function verdictFactsQuery(input: {
  businessId: string;
  consumerId: string;
  membershipId: string | null;
  coupon: Pick<VerdictCoupon, "id" | "campaignId">;
  now: Date;
}): SQL {
  const { businessId, consumerId, coupon, now } = input;
  const card =
    input.membershipId === null
      ? sql`(select m2.id from consumer.program_membership m2
            join core.loyalty_program p2 on p2.id = m2.program_id
            where m2.business_id = ${businessId} and m2.consumer_id = ${consumerId}
              and p2.status in ('active', 'closing')
            limit 1)`
      : sql`${input.membershipId}::uuid`;
  return sql`
    select
      (select b0.timezone from core.business b0 where b0.id = ${businessId}) as timezone,
      (select ca.coupon_max_redemptions from core.campaign ca
        where ca.id = ${coupon.campaignId}) as cap,
      (select count(*)::int from core.coupon_redemption cc
        where cc.campaign_id = ${coupon.campaignId}) as redeemed_count,
      exists (select 1 from core.coupon_redemption cs
        where cs.coupon_id = ${coupon.id}) as redeemed,
      exists (select 1 from core.coupon_redemption cr
        join core.business b on b.id = cr.business_id
        where cr.business_id = ${businessId} and cr.consumer_id = ${consumerId}
          and ${createdToday(now)}) as used_today,
      m.program_id as m_program_id, m.stamps_count as m_stamps,
      m.points_balance as m_points,
      p.id as p_id, p.status as p_status, p.kind as p_kind
    from (select 1) as one
    left join consumer.program_membership m
      on m.id = ${card} and m.business_id = ${businessId}
    left join lateral (
      select lp.id, lp.status, lp.kind from core.loyalty_program lp
      where lp.business_id = ${businessId} and lp.status in ('active', 'closing')
      limit 1
    ) p on true
  `;
}

/** PURE: the row of {@link verdictFactsQuery} as the facts of `decideCouponVerdict`. */
export function toVerdictFacts(
  row: VerdictFactsRow,
  coupon: VerdictCoupon,
  now: Date,
): VerdictFacts {
  const kind = coupon.kindSnapshot;
  const extra: ExtraFacts | null =
    kind === "extra_stamps" || kind === "extra_points"
      ? {
          kind,
          units: coupon.extraUnitsSnapshot ?? 0,
          membership:
            row.m_program_id === null
              ? null
              : {
                  programId: row.m_program_id,
                  stampsCount: Number(row.m_stamps ?? 0),
                  pointsBalance: Number(row.m_points ?? 0),
                },
          program:
            row.p_id === null
              ? null
              : {
                  id: row.p_id,
                  status: String(row.p_status),
                  kind: String(row.p_kind),
                },
        }
      : null;
  return {
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil,
    redeemed: row.redeemed === true,
    couponMaxRedemptions: row.cap === null ? null : Number(row.cap),
    redeemedCount: Number(row.redeemed_count),
    usedToday: row.used_today === true,
    extra,
    timezone: row.timezone,
    now,
  };
}

/**
 * The sale's half (spec 0153 M4): under the three locks, the verdict of the LOCKED coupon over
 * facts re-read in the transaction; an invalid one is a `409` with the verdict's own `code`.
 */
export async function assertCouponVerdict(
  tx: DbTransaction,
  input: {
    locked: LockedCoupon;
    businessId: string;
    membershipId: string;
    now: Date;
  },
): Promise<void> {
  const { coupon, campaign } = input.locked;
  const verdictCoupon: VerdictCoupon = {
    id: coupon.id,
    campaignId: campaign.id,
    kindSnapshot: coupon.kindSnapshot,
    extraUnitsSnapshot: coupon.extraUnitsSnapshot,
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil,
  };
  const result = await tx.execute<VerdictFactsRow>(
    verdictFactsQuery({
      businessId: input.businessId,
      consumerId: coupon.consumerId,
      membershipId: input.membershipId,
      coupon: verdictCoupon,
      now: input.now,
    }),
  );
  const verdict = decideCouponVerdict(
    toVerdictFacts(result.rows[0], verdictCoupon, input.now),
  );
  if (!verdict.valid)
    throw new CounterError(409, verdict.code, verdict.message);
}
