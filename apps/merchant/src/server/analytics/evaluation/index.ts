import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  analyticsCardCandidates as candidates,
  analyticsCardStates as states,
  analyticsEvaluationRuns as runs,
  businesses,
} from "@mi-pasaporte/db/schema";
import { buildCandidates } from "@mi-pasaporte/domain/analytics/cards/index";
import { localDay } from "@mi-pasaporte/domain/analytics/date";
import { selectCards } from "@mi-pasaporte/domain/analytics/weights";
import type {
  CardCandidate,
  InboxCard,
} from "@mi-pasaporte/domain/analytics/types";
import {
  AnalyticsError,
  inputStatement,
  inputFromRow,
  safeMoney,
} from "../queries";
import { actionContext, type AnalyticsViewer } from "../actions";
export const evaluationLockKey = (businessId: string, day: string) =>
  `analytics:evaluate:${businessId}:${day}`;
export async function businessDay(businessId: string, now = new Date()) {
  const [business] = await getDb()
    .select({ timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!business)
    throw new AnalyticsError(
      404,
      "business_not_found",
      "No encontramos el negocio.",
    );
  return localDay(now, business.timezone);
}
/** One atomic claim: readers see the previous completed day until this transaction commits. */
export async function evaluateBusiness(
  businessId: string,
  now = new Date(),
  options: {
    budgetMs?: number;
    trace?: (stage: string, milliseconds: number) => void;
  } = {},
): Promise<boolean> {
  const connecting = performance.now();
  return withDbTransaction(async (tx) => {
    options.trace?.("transaction_connection", performance.now() - connecting);
    const claimStarted = performance.now();
    const budget = Math.max(1, Math.floor(options.budgetMs ?? 20_000));
    const result =
      await tx.execute(sql`with business_clock as materialized (select (${now.toISOString()}::timestamptz at time zone timezone)::date as day from core.business where id=${businessId}),
      settings as materialized (select set_config('statement_timeout',${String(Math.max(1, budget - 100))},true),set_config('transaction_timeout',${String(budget)},true)),
      acquired as materialized (select business_clock.day,pg_try_advisory_xact_lock(hashtextextended('analytics:evaluate:'||${businessId}||':'||business_clock.day::text,0)) ok from business_clock,settings),
      inserted as (insert into analytics.evaluation_run(business_id,day,status,claimed_at) select ${businessId}::uuid,day,'preparing',${now.toISOString()}::timestamptz from acquired where ok on conflict do nothing returning business_id),
      existing as (select r.business_id from analytics.evaluation_run r,acquired where acquired.ok and r.business_id=${businessId} and r.day=acquired.day and r.status<>'ready' for update of r skip locked),
      claim as materialized (select business_clock.day::text as day,exists(select business_id from inserted union all select business_id from existing) claimed from business_clock)
      select claim.day,claim.claimed,case when claim.claimed then (select row_to_json(snapshot) from (${inputStatement(businessId, now)}) snapshot) else null end payload from claim`);
    const claimed = result.rows[0];
    if (!claimed)
      throw new AnalyticsError(
        404,
        "business_not_found",
        "No encontramos el negocio.",
      );
    if (!claimed.claimed) return false;
    const day = String(claimed.day);
    const input = inputFromRow(claimed.payload as Record<string, unknown>);
    options.trace?.(
      "claim_and_summary_round_trip",
      performance.now() - claimStarted,
    );
    const calculating = performance.now();
    const cards = buildCandidates(input, input.states);
    options.trace?.("pure_calculation", performance.now() - calculating);
    const writing = performance.now();
    const rows = cards.map((card) => ({
      card_key: card.cardKey,
      subject_key: card.subjectKey,
      weight: String(card.weight),
      amount_minor: card.amountMinor === null ? null : String(card.amountMinor),
      currency_code: card.currencyCode,
      minor_unit: card.minorUnit,
      parameters: {
        sender: card.sender,
        title: card.title,
        body: card.body,
        quality: card.quality,
        actionKey: card.actionKey,
        actionHref: card.actionHref,
      },
      fingerprint: card.fingerprint,
      location_id: card.locationId,
    }));
    await tx.execute(sql`with saved as (insert into analytics.card_candidate(business_id,day,card_key,subject_key,weight,amount_minor,currency_code,minor_unit,parameters,fingerprint,location_id)
      select ${businessId}::uuid,${day}::date,c.card_key,c.subject_key,c.weight,c.amount_minor,c.currency_code,c.minor_unit,c.parameters,c.fingerprint,c.location_id
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as c(card_key text,subject_key text,weight numeric,amount_minor bigint,currency_code text,minor_unit int,parameters jsonb,fingerprint text,location_id uuid) on conflict do nothing returning id)
      update analytics.evaluation_run set status='ready',prepared_at=clock_timestamp() where business_id=${businessId} and day=${day}::date`);
    options.trace?.("persistence_round_trips", performance.now() - writing);
    return true;
  });
}
export async function evaluateDueBusinesses(now = new Date()) {
  const deadline = Date.now() + 20_000;
  let processed = 0;
  let skipped = 0;
  const due = await getDb()
    .execute(sql`select b.id from core.business b where b.status = 'active'
    and ((${now.toISOString()}::timestamptz at time zone b.timezone)::time >= time '03:00')
    and not exists (select 1 from analytics.evaluation_run e where e.business_id=b.id and e.day=(${now.toISOString()}::timestamptz at time zone b.timezone)::date and e.status='ready')
    and (exists (select 1 from analytics.daily_metric m where m.business_id=b.id and m.day >= ((${now.toISOString()}::timestamptz at time zone b.timezone)::date - 35))
      or not exists(select 1 from analytics.daily_metric m where m.business_id=b.id)) order by b.id limit 20`);
  for (const row of due.rows) {
    if (Date.now() >= deadline) {
      skipped++;
      continue;
    }
    if (
      await evaluateBusiness(String(row.id), now, {
        budgetMs: Math.max(1, deadline - Date.now()),
      })
    )
      processed++;
    else skipped++;
  }
  return { processed, skipped };
}
async function selectedCandidates(
  tx: DbTransaction,
  businessId: string,
  day: string,
) {
  const [rows, previous] = await Promise.all([
    tx
      .select()
      .from(candidates)
      .where(
        and(eq(candidates.businessId, businessId), eq(candidates.day, day)),
      ),
    tx.select().from(states).where(eq(states.businessId, businessId)),
  ]);
  return selectCards(
    rows.map((c) => {
      const state = previous.find(
        (s) => s.cardKey === c.cardKey && s.subjectKey === c.subjectKey,
      );
      return {
        ...c,
        weight:
          state &&
          state.fingerprint === c.fingerprint &&
          state.status !== "shown"
            ? 0
            : Number(c.weight),
      };
    }),
  );
}
export async function readInbox(
  businessId: string,
  viewer: AnalyticsViewer,
  now = new Date(),
  allowYesterday = false,
) {
  const today = await businessDay(businessId, now);
  const db = getDb();
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.businessId, businessId), eq(runs.day, today)))
    .limit(1);
  const ready = run?.status === "ready";
  let day = today;
  if (!ready && !allowYesterday)
    return {
      state: "preparing" as const,
      preparedAt: null,
      cards: [] as InboxCard[],
    };
  if (!ready && allowYesterday) {
    const old = await db.execute(
      sql`select day from analytics.evaluation_run where business_id=${businessId} and day=${today}::date - 1 and status='ready' limit 1`,
    );
    if (old.rows[0]) day = String(old.rows[0].day).slice(0, 10);
    else
      return {
        state: "preparing" as const,
        preparedAt: null,
        cards: [] as InboxCard[],
      };
  }
  const resolve = await actionContext(businessId, viewer);
  const cards = await withDbTransaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${evaluationLockKey(businessId, day)}, 0))`,
    );
    const selected = await selectedCandidates(tx, businessId, day);
    for (const card of selected) {
      await tx
        .insert(states)
        .values({
          businessId,
          cardKey: card.cardKey,
          subjectKey: card.subjectKey,
          fingerprint: card.fingerprint,
          status: "shown",
          shownDays: 1,
          lastShownDay: today,
        })
        .onConflictDoUpdate({
          target: [states.businessId, states.cardKey, states.subjectKey],
          set: {
            fingerprint: card.fingerprint,
            status: "shown",
            lastShownDay: today,
            shownDays: sql`case when ${states.fingerprint} <> ${card.fingerprint} then 1 when ${states.lastShownDay} <> ${today} then ${states.shownDays} + 1 else ${states.shownDays} end`,
            updatedAt: now,
          },
        });
    }
    return selected.map((card) => {
      const p = card.parameters as Pick<
        CardCandidate,
        "sender" | "title" | "body" | "quality" | "actionKey" | "actionHref"
      >;
      return {
        id: card.id,
        cardKey: card.cardKey,
        sender: p.sender,
        title: p.title,
        body: p.body,
        quality: p.quality,
        amountAtStake:
          card.amountMinor === null
            ? null
            : {
                amountMinor: safeMoney(card.amountMinor),
                currencyCode: card.currencyCode,
                minorUnit: card.minorUnit,
              },
        action: resolve(p.actionKey, p.actionHref),
      } satisfies InboxCard;
    });
  });
  return {
    state: ready ? ("ready" as const) : ("preparing" as const),
    preparedAt: run?.preparedAt?.toISOString() ?? null,
    cards,
  };
}
export async function actOnCard(
  businessId: string,
  userId: string,
  id: string,
  status: "accepted" | "dismissed",
  viewer: AnalyticsViewer,
  now = new Date(),
) {
  const today = await businessDay(businessId, now);
  await withDbTransaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${evaluationLockKey(businessId, today)}, 0))`,
    );
    const selected = await selectedCandidates(tx, businessId, today);
    const card = selected.find((c) => c.id === id);
    if (!card)
      throw new AnalyticsError(
        404,
        "card_not_found",
        "No encontramos esa tarjeta de hoy.",
      );
    await tx
      .insert(states)
      .values({
        businessId,
        cardKey: card.cardKey,
        subjectKey: card.subjectKey,
        fingerprint: card.fingerprint,
        status,
        shownDays: 1,
        lastShownDay: today,
        actedBy: userId,
      })
      .onConflictDoUpdate({
        target: [states.businessId, states.cardKey, states.subjectKey],
        set: {
          status,
          fingerprint: card.fingerprint,
          actedBy: userId,
          updatedAt: now,
        },
      });
  });
  return { cards: (await readInbox(businessId, viewer, now)).cards };
}
