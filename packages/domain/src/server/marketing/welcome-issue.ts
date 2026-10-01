import { sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import { rewardSnapshot } from "./coupon-issue";
import { requireDate } from "./driver-values";
import {
  capAllows,
  decideWelcomeGift,
  localMonthStart,
  welcomeValidFrom,
  welcomeValidUntil,
} from "./welcome-rules";
import { countMonthGifts, loadWelcomeCampaign } from "./welcome-store";
import { hasCrossCouponFrom } from "./cross-store";

/**
 * THE DELIVERY OF THE WELCOME GIFT (spec 0107 §3 / ADR 0099). One consumer, every
 * membership whose business has an ELIGIBLE welcome campaign (`welcome-store.ts`), in ONE
 * transaction, and for each one in the spec's order: enrolled after the switch-on → no
 * cross coupon of that business (spec 0112, «solo el cruzado») → installed pass → durable Apple filter of THAT business → monthly cap under the
 * campaign's `for update` → the coupon (`on conflict (welcome_membership_id) do nothing`)
 * and, if it was inserted, every device of the consumer burned in `core.welcome_device`.
 *
 * Idempotent by construction: the unique per membership makes a second trigger —Apple's
 * registration, Google's `save`, the enroll, the tick's sweep— a no-op. The triggers are
 * BEST-EFFORT (`issueWelcomeGiftsSafely`): a failure is logged and never changes the answer
 * of the route that triggered it; the tick's sweep recovers what a trigger lost.
 */

export type WelcomeTrigger = {
  /** The iPhone registering right now: it counts even if its row is not visible yet. */
  deviceLibraryId?: string;
};

type Rows<T> = { rows?: T[] } | T[];
function rowsOf<T>(result: unknown): T[] {
  const value = result as Rows<T>;
  return Array.isArray(value) ? value : (value?.rows ?? []);
}

/** The consumer's installed-pass facts: Apple devices (+ the trigger's) and Google's save. */
async function installedFacts(
  tx: DbTransaction,
  consumerId: string,
  trigger: WelcomeTrigger,
): Promise<{ devices: string[]; googleSaved: boolean }> {
  const result = await tx.execute(sql`
    select d.device_library_id
    from consumer.wallet_push_device d
    join consumer.wallet_pass p on p.id = d.wallet_pass_id
    where p.consumer_id = ${consumerId} and p.provider = 'apple'`);
  const devices = new Set(
    rowsOf<{ device_library_id: string }>(result).map(
      (row) => row.device_library_id,
    ),
  );
  if (trigger.deviceLibraryId) devices.add(trigger.deviceLibraryId);
  const google = await tx.execute(sql`
    select exists (select 1 from consumer.wallet_pass g
                    where g.consumer_id = ${consumerId} and g.provider = 'google'
                      and g.google_saved_at is not null) as saved`);
  const [row] = rowsOf<{ saved: boolean }>(google);
  return { devices: [...devices], googleSaved: row?.saved === true };
}

/** Whether any of these devices already got THIS business's welcome (the durable filter). */
async function deviceAlreadyGifted(
  tx: DbTransaction,
  businessId: string,
  devices: string[],
): Promise<boolean> {
  if (devices.length === 0) return false;
  const list = sql.join(
    devices.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await tx.execute(sql`
    select exists (select 1 from core.welcome_device w
                    where w.business_id = ${businessId}
                      and w.device_library_id in (${list})) as gifted`);
  const [row] = rowsOf<{ gifted: boolean }>(result);
  return row?.gifted === true;
}

/**
 * Inside the caller's transaction (the tick's sweep runs it under its lock). `businessIds`
 * narrows the memberships (the tick's test scope); production passes none.
 */
export async function issueWelcomeGiftsIn(
  tx: DbTransaction,
  consumerId: string,
  now: Date,
  trigger: WelcomeTrigger = {},
  businessIds?: string[],
): Promise<number> {
  const memberships = rowsOf<Record<string, unknown>>(
    await tx.execute(sql`
      select m.id, m.business_id, m.enrolled_at
      from consumer.program_membership m
      where m.consumer_id = ${consumerId}
        and not exists (select 1 from core.campaign_coupon cc
                         where cc.welcome_membership_id = m.id)
        ${inList("m.business_id", businessIds)}
      order by m.enrolled_at, m.id`),
  );
  if (memberships.length === 0) return 0;
  const installed = await installedFacts(tx, consumerId, trigger);
  let issued = 0;
  for (const membership of memberships) {
    const businessId = String(membership.business_id);
    const campaign = await loadWelcomeCampaign(tx, businessId, now);
    if (!campaign) continue;
    const verdict = decideWelcomeGift({
      enrolledAt: requireDate(membership.enrolled_at),
      activatedAt: campaign.activatedAt,
      appleDevices: installed.devices.length,
      googleSaved: installed.googleSaved,
      deviceAlreadyGifted: await deviceAlreadyGifted(
        tx,
        businessId,
        installed.devices,
      ),
      crossCouponFromBusiness: await hasCrossCouponFrom(
        tx,
        consumerId,
        businessId,
      ),
    });
    if (verdict !== "issue") continue;
    await tx.execute(
      sql`select id from core.campaign where id = ${campaign.id} for update`,
    );
    const given = await countMonthGifts(
      tx,
      businessId,
      localMonthStart(now, campaign.timeZone),
    );
    if (!capAllows(given, campaign.monthlyCap)) continue;
    const reward = rewardSnapshot(campaign.reward);
    const validFrom = welcomeValidFrom(
      now,
      campaign.redeemFrom,
      campaign.timeZone,
    );
    const inserted = rowsOf<{ id: string }>(
      await tx.execute(sql`
        insert into core.campaign_coupon
          (campaign_id, business_id, consumer_id, membership_id, welcome_membership_id,
           label_snapshot, cost_snapshot, kind_snapshot, product_id,
           discount_unit_snapshot, discount_value_snapshot, currency_code_snapshot,
           extra_units_snapshot, rule_snapshot, valid_from, valid_until, created_at)
        values (${campaign.id}, ${businessId}, ${consumerId}, ${membership.id},
          ${membership.id}, ${campaign.couponLabel}, ${campaign.couponCost},
          ${reward.kindSnapshot}, ${reward.productId}, ${reward.discountUnitSnapshot},
          ${reward.discountValueSnapshot}, ${reward.currencyCodeSnapshot},
          ${reward.extraUnitsSnapshot}, ${reward.ruleSnapshot},
          ${validFrom.toISOString()},
          ${welcomeValidUntil(now, campaign.validDays).toISOString()},
          ${now.toISOString()})
        on conflict (welcome_membership_id) do nothing
        returning id`),
    );
    const [coupon] = inserted;
    if (!coupon) continue;
    issued += 1;
    for (const device of installed.devices)
      await tx.execute(sql`
        insert into core.welcome_device (business_id, device_library_id, coupon_id)
        values (${businessId}, ${device}, ${coupon.id})
        on conflict (business_id, device_library_id) do nothing`);
  }
  return issued;
}

function inList(column: string, ids: string[] | undefined) {
  return ids && ids.length > 0
    ? sql`and ${sql.raw(column)} in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql``;
}

/**
 * THE TICK's SWEEP (spec 0107 §3): consumers with an enrolment after the switch-on of an
 * active welcome, no gift yet and an installed pass → `issueWelcomeGiftsIn`. It recovers a
 * trigger that was lost (a best-effort failure, a deploy in between). Runs in the tick's
 * transaction, under its lock. `businessIds`/`consumerIds` are the tick's test scope.
 */
export async function sweepWelcomeGifts(
  tx: DbTransaction,
  now: Date,
  businessIds?: string[],
  consumerIds?: string[],
): Promise<number> {
  const at = now.toISOString();
  const consumers = rowsOf<{ consumer_id: string }>(
    await tx.execute(sql`
      select distinct m.consumer_id
      from consumer.program_membership m
      join core.campaign c on c.business_id = m.business_id
        and c.template_key = 'welcome' and c.status = 'active'
        and c.activated_at is not null and m.enrolled_at >= c.activated_at
        and c.starts_at <= ${at}::timestamptz
        and (c.ends_at is null or c.ends_at > ${at}::timestamptz)
      where not exists (select 1 from core.campaign_coupon cc
                         where cc.welcome_membership_id = m.id)
        and (exists (select 1 from consumer.wallet_push_device d
                       join consumer.wallet_pass p on p.id = d.wallet_pass_id
                     where p.consumer_id = m.consumer_id and p.provider = 'apple')
             or exists (select 1 from consumer.wallet_pass g
                         where g.consumer_id = m.consumer_id and g.provider = 'google'
                           and g.google_saved_at is not null))
        ${inList("m.business_id", businessIds)}
        ${inList("m.consumer_id", consumerIds)}`),
  );
  let issued = 0;
  for (const row of consumers)
    issued += await issueWelcomeGiftsIn(
      tx,
      row.consumer_id,
      now,
      {},
      businessIds,
    );
  return issued;
}

/** `issueWelcomeGiftsIn` in its own transaction: the triggers' entry point. */
export async function issueWelcomeGifts(
  consumerId: string,
  now: Date = new Date(),
  trigger: WelcomeTrigger = {},
): Promise<number> {
  return await withDbTransaction((tx) =>
    issueWelcomeGiftsIn(tx, consumerId, now, trigger),
  );
}

/** BEST-EFFORT for the routes: a failure is logged and never reaches the response. */
export async function issueWelcomeGiftsSafely(
  consumerId: string,
  trigger: WelcomeTrigger = {},
): Promise<void> {
  try {
    await issueWelcomeGifts(consumerId, new Date(), trigger);
  } catch (error) {
    console.error("[welcome] issueWelcomeGifts failed", error);
  }
}
