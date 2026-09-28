import { sql } from "drizzle-orm";
import { type DbTransaction, getDb } from "../db";
import { requireDate } from "./driver-values";
import type { CampaignGate, PushCancelReason } from "./push-delivery";
import { isInPushWindow, nextSendableAt } from "./push-window";

/**
 * THE EXPIRY NOTICE OF THE WELCOME GIFT (spec 0107 §5 / ADR 0099 §4). A tick step queues
 * ONE `campaign` push per welcome coupon when `valid_until − reminder_days` arrives, and the
 * worker's gate (`gateCampaignPush`, `push-delivery.ts`) asks {@link gateWelcomeReminder}
 * at delivery: a coupon redeemed, expired, of a membership that is gone or opted out in
 * between must not produce the notice. There is no `campaign_push` behind it: the coupon
 * points at its queue row (`reminder_queue_id`), one coupon, one notice.
 */

const DAY_MS = 86_400_000;

/** The instant the notice is due: `reminderDays` BEFORE it expires (never after it starts). */
export function reminderDueAt(validUntil: Date, reminderDays: number): Date {
  return new Date(validUntil.getTime() - reminderDays * DAY_MS);
}

/** Whole days left, rounded up and at least 1 (the notice never says «0 días»). */
export function reminderDaysLeft(validUntil: Date, now: Date): number {
  return Math.max(
    1,
    Math.ceil((validUntil.getTime() - now.getTime()) / DAY_MS),
  );
}

export function reminderBody(daysLeft: number): string {
  return `Tu regalo de bienvenida vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`;
}

/** What the gate reads of the coupon behind one queued notice. */
export type ReminderFacts = {
  redeemed: boolean;
  validUntil: Date;
  membershipExists: boolean;
  optedOut: boolean;
  timeZone: string;
  windowStart: number;
  windowEnd: number;
};

/**
 * PURE, in this order: redeemed → expired → membership gone → opt-out cancel; outside the
 * business's hours reschedules to the next opening; otherwise SEND, with no click id (no
 * `campaign_push` to credit).
 */
export function decideReminderGate(
  facts: ReminderFacts,
  now: Date,
): CampaignGate {
  const cancel = (reason: PushCancelReason): CampaignGate => ({
    kind: "cancel",
    reason,
  });
  if (facts.redeemed) return cancel("redeemed");
  if (now >= facts.validUntil) return cancel("expired");
  if (!facts.membershipExists) return cancel("membership_gone");
  if (facts.optedOut) return cancel("opt_out");
  if (!isInPushWindow(now, facts.timeZone, facts.windowStart, facts.windowEnd))
    return {
      kind: "reschedule",
      notBefore: nextSendableAt(
        now,
        facts.timeZone,
        facts.windowStart,
        facts.windowEnd,
      ),
    };
  return { kind: "send" };
}

type Rows<T> = { rows?: T[] } | T[];
function rowsOf<T>(result: unknown): T[] {
  const value = result as Rows<T>;
  return Array.isArray(value) ? value : (value?.rows ?? []);
}

/**
 * The gate for a `campaign` row with NO `campaign_push` behind it. With no welcome coupon
 * pointing at the row either, it is SEND — what the gate did before this spec (an orphan
 * row should not exist, and if it does the notice is not lost). `cancel` closes the row
 * with the reason in `last_error`; `reschedule` hands it back at the next opening.
 */
export async function gateWelcomeReminder(
  queueId: string,
  now: Date,
): Promise<CampaignGate> {
  const result = await getDb().execute(sql`
    select cc.valid_until,
      exists (select 1 from core.coupon_redemption r where r.coupon_id = cc.id) as redeemed,
      (m.id is not null) as membership_exists,
      (m.marketing_opt_out_at is not null) as opted_out,
      b.timezone, b.push_window_start_hour, b.push_window_end_hour
    from core.campaign_coupon cc
    join core.business b on b.id = cc.business_id
    left join consumer.program_membership m on m.id = cc.welcome_membership_id
    where cc.reminder_queue_id = ${queueId}
    limit 1`);
  const [row] = rowsOf<Record<string, unknown>>(result);
  if (!row) return { kind: "send" };
  const gate = decideReminderGate(
    {
      redeemed: row.redeemed === true,
      validUntil: requireDate(row.valid_until),
      membershipExists: row.membership_exists === true,
      optedOut: row.opted_out === true,
      timeZone: String(row.timezone),
      windowStart: Number(row.push_window_start_hour),
      windowEnd: Number(row.push_window_end_hour),
    },
    now,
  );
  if (gate.kind === "cancel")
    await getDb().execute(sql`
      update consumer.wallet_push_queue
      set status = 'cancelled', last_error = ${gate.reason}
      where id = ${queueId}`);
  if (gate.kind === "reschedule")
    await getDb().execute(sql`
      update consumer.wallet_push_queue
      set status = 'pending', not_before = ${gate.notBefore.toISOString()}
      where id = ${queueId}`);
  return gate;
}

/**
 * THE TICK STEP (after the welcome sweep, in the tick's transaction): every welcome coupon
 * in its validity, unredeemed, with no notice yet and its membership not opted out, whose
 * due instant ({@link reminderDueAt}) has arrived → a `campaign` row (title = business name,
 * not before the business's next opening) and `reminder_queue_id`, together. `businessIds`
 * is the tick's test scope. Returns how many notices were queued.
 */
export async function enqueueWelcomeReminders(
  tx: DbTransaction,
  now: Date,
  businessIds?: string[],
): Promise<number> {
  const at = now.toISOString();
  const scope =
    businessIds && businessIds.length > 0
      ? sql`and cc.business_id in (${sql.join(
          businessIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
  const candidates = rowsOf<Record<string, unknown>>(
    await tx.execute(sql`
      select cc.id, cc.consumer_id, cc.valid_until, c.welcome_reminder_days,
        b.name, b.timezone, b.push_window_start_hour, b.push_window_end_hour
      from core.campaign_coupon cc
      join core.campaign c on c.id = cc.campaign_id
      join core.business b on b.id = cc.business_id
      join consumer.program_membership m on m.id = cc.welcome_membership_id
      where cc.reminder_queue_id is null
        and c.welcome_reminder_days is not null
        and not exists (select 1 from core.coupon_redemption r where r.coupon_id = cc.id)
        and cc.valid_from <= ${at}::timestamptz
        and cc.valid_until > ${at}::timestamptz
        and m.marketing_opt_out_at is null
        ${scope}
      order by cc.valid_until, cc.id
      for update of cc`),
  );
  let queued = 0;
  for (const row of candidates) {
    const validUntil = requireDate(row.valid_until);
    const due = reminderDueAt(validUntil, Number(row.welcome_reminder_days));
    if (now < due) continue;
    const timeZone = String(row.timezone);
    const start = Number(row.push_window_start_hour);
    const end = Number(row.push_window_end_hour);
    const [queue] = rowsOf<{ id: string }>(
      await tx.execute(sql`
        insert into consumer.wallet_push_queue
          (consumer_id, class, title, body, status, not_before)
        values (${row.consumer_id}, 'campaign', ${String(row.name)},
          ${reminderBody(reminderDaysLeft(validUntil, now))}, 'pending',
          ${nextSendableAt(now, timeZone, start, end).toISOString()})
        returning id`),
    );
    await tx.execute(sql`
      update core.campaign_coupon set reminder_queue_id = ${queue.id}
      where id = ${row.id}`);
    queued += 1;
  }
  return queued;
}
