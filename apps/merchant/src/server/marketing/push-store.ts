/**
 * The DB half of step «1b push» of the tick (spec 0103 §4 / ADR 0095): it loads the push
 * campaigns and the facts `decidePushEligibility` needs, and writes each decision
 * (`core.campaign_push` + its `wallet_push_queue` row). Every function takes the tick's
 * transaction, which holds the advisory lock (see `tick.ts`).
 */

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  campaignPushes,
  campaigns,
  walletPushQueue,
} from "@mi-pasaporte/db/schema";
import { requireDate, toDate } from "./driver-values";
import type { PushCandidate } from "./push-audience";
import { pushBody } from "./push-text";
import { nextSendableAt } from "./push-window";
import {
  type RewardRepeat,
  type TemplateDefinition,
  templateByKey,
  templateKeysAtOrAbove,
} from "./templates";

export type PushCampaign = {
  id: string;
  businessId: string;
  template: TemplateDefinition;
  dormantDays: number;
  message: string;
  couponLabel: string | null;
  /** Spec 0104: #7's thresholds and #8's repetition (`null` in every other template). */
  nearRewardStamps: number | null;
  nearRewardPercent: number | null;
  rewardRepeat: RewardRepeat | null;
  businessName: string;
  timeZone: string;
  windowStart: number;
  windowEnd: number;
};

/**
 * Campaigns that push right now: `active`, in date, `channel_push` and a template (the
 * composer never pushes). ORDERED BY RANK DESC (ADR 0095 §5): in one tick the higher
 * template of a group decides first, so a lost customer gets «Recuperar perdidos» and the
 * group rule then keeps «Te extrañamos» out. `created_at`, `id` make the tie stable.
 */
export async function loadPushCampaigns(
  db: DbTransaction,
  now: Date,
  businessIds?: string[],
): Promise<PushCampaign[]> {
  const rows = await db
    .select({
      id: campaigns.id,
      businessId: campaigns.businessId,
      templateKey: campaigns.templateKey,
      dormantDays: campaigns.dormantDays,
      message: campaigns.message,
      couponLabel: campaigns.couponLabel,
      nearRewardStamps: campaigns.nearRewardStamps,
      nearRewardPercent: campaigns.nearRewardPercent,
      rewardRepeat: campaigns.rewardRepeat,
      businessName: businesses.name,
      timeZone: businesses.timezone,
      windowStart: businesses.pushWindowStartHour,
      windowEnd: businesses.pushWindowEndHour,
    })
    .from(campaigns)
    .innerJoin(businesses, eq(businesses.id, campaigns.businessId))
    .where(
      and(
        eq(campaigns.status, "active"),
        eq(campaigns.channelPush, true),
        isNotNull(campaigns.templateKey),
        lte(campaigns.startsAt, now),
        or(isNull(campaigns.endsAt), gt(campaigns.endsAt, now)),
        businessIds && businessIds.length > 0
          ? inArray(campaigns.businessId, businessIds)
          : undefined,
      ),
    )
    .orderBy(asc(campaigns.createdAt), asc(campaigns.id));
  const known = rows.flatMap(({ templateKey, rewardRepeat, ...row }) => {
    const template = templateByKey(templateKey ?? "");
    return template
      ? [
          {
            ...row,
            // The `core_campaign_reward_repeat_check` pins the two values.
            rewardRepeat: rewardRepeat as RewardRepeat | null,
            template,
          },
        ]
      : [];
  });
  // `sort` is stable: equal ranks keep the `created_at`, `id` order of the query.
  return known.sort((a, b) => b.template.rank - a.template.rank);
}

/**
 * Every membership of the business with the push facts. RAW SQL with its own aliases
 * (`m`, `o`, `b`, `d`, `p`, `g`, `w`, `cp`, `c`): a correlated subquery written with the
 * builder renders the outer column UNQUALIFIED and silently binds to the inner table (see
 * `audience-store.ts`, measured in A5). `push_reachable` is `consumerHasReachableWallet`
 * (`wallet/push-transports.ts`) plus Web Push. `visit_days`/`first_order_at` are #4's habit
 * (spec 0105): distinct days in the BUSINESS's timezone, the same expression as
 * `loadAudienceCandidates`.
 */
export async function loadPushCandidates(
  db: DbTransaction,
  businessId: string,
  template: Pick<TemplateDefinition, "group" | "rank">,
): Promise<PushCandidate[]> {
  const keys = sql.join(
    templateKeysAtOrAbove(template).map((key) => sql`${key}`),
    sql`, `,
  );
  const result = await db.execute<{
    membership_id: string;
    consumer_id: string;
    marketing_opt_out_at: string | null;
    enrolled_at: string;
    last_order_at: string | null;
    visit_days: number;
    first_order_at: string | null;
    push_reachable: boolean;
    last_group_decision_at: string | null;
  }>(sql`
    select
      m.id as membership_id,
      m.consumer_id,
      m.marketing_opt_out_at,
      m.enrolled_at,
      (select max(o.created_at) from core."order" o
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id) as last_order_at,
      (select count(distinct (o.created_at at time zone b.timezone)::date)::int
         from core."order" o join core.business b on b.id = o.business_id
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id) as visit_days,
      (select min(o.created_at) from core."order" o
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id) as first_order_at,
      (exists (select 1 from consumer.wallet_push_device d
                 join consumer.wallet_pass p on p.id = d.wallet_pass_id
               where p.consumer_id = m.consumer_id and p.provider = 'apple')
       or exists (select 1 from consumer.wallet_pass g
                   where g.consumer_id = m.consumer_id and g.provider = 'google')
       or exists (select 1 from consumer.web_push_subscription w
                   where w.consumer_id = m.consumer_id)) as push_reachable,
      (select max(cp.decided_at) from core.campaign_push cp
         join core.campaign c on c.id = cp.campaign_id
       where cp.business_id = m.business_id and cp.consumer_id = m.consumer_id
         and cp.cancelled_at is null
         and c.template_key in (${keys})) as last_group_decision_at
    from consumer.program_membership m
    where m.business_id = ${businessId}
  `);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    consumerId: row.consumer_id,
    marketingOptOutAt: toDate(row.marketing_opt_out_at),
    enrolledAt: requireDate(row.enrolled_at),
    lastOrderAt: toDate(row.last_order_at),
    visitDays: Number(row.visit_days),
    firstOrderAt: toDate(row.first_order_at),
    pushReachable: row.push_reachable,
    lastGroupDecisionAt: toDate(row.last_group_decision_at),
  }));
}

/**
 * Writes ONE decision. A holdout is recorded with no queue row (the control group); any
 * other enqueues the `campaign` notice —title = business name, body frozen now, not
 * before the next opening of the business's window— and points at it. `body` is the
 * already-rendered text of a balance template (#7's `{faltan}` per consumer, spec 0104);
 * without it the body is `pushBody` of the campaign.
 */
export async function recordPushDecision(
  db: DbTransaction,
  campaign: PushCampaign,
  candidate: Pick<PushCandidate, "consumerId" | "membershipId">,
  holdout: boolean,
  now: Date,
  body?: string,
): Promise<void> {
  let queueId: string | null = null;
  if (!holdout) {
    const [queued] = await db
      .insert(walletPushQueue)
      .values({
        consumerId: candidate.consumerId,
        class: "campaign",
        title: campaign.businessName,
        body: body ?? pushBody(campaign.message, campaign.couponLabel),
        status: "pending",
        notBefore: nextSendableAt(
          now,
          campaign.timeZone,
          campaign.windowStart,
          campaign.windowEnd,
        ),
      })
      .returning({ id: walletPushQueue.id });
    queueId = queued.id;
  }
  await db.insert(campaignPushes).values({
    campaignId: campaign.id,
    businessId: campaign.businessId,
    consumerId: candidate.consumerId,
    membershipId: candidate.membershipId,
    holdout,
    queueId,
    decidedAt: now,
  });
}
