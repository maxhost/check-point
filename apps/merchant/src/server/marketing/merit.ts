/**
 * The order of the queue (ADR 0066): merit with a balance, from day one, measured by
 * LIFT — never by the raw «bought in its window» rate, which is the bug the ADR 0065 §4
 * documented with numbers (a business aiming at dormant customers who were coming back
 * anyway measures 33 % and generates +3, while one aiming at lost customers measures
 * 10 % and generates +8).
 *
 * `businessScore` is PURE and is the only thing `planConsumerPlacement` consumes (as an
 * injected `Map`, ADR 0066 §5). `loadBusinessTurnStats` is the ONLY part of this file
 * that touches the database.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { campaignTurns } from "../schema/campaign-turn";

/** Weight of the prior, in turns (ORQUESTADOR, ADR 0066 §3). */
export const MERIT_ALPHA = 20;

/** Per business, over turns already `done`. Placed and holdout are counted apart: the
 * subtraction of their two rates IS the lift. */
export type BusinessTurnStats = {
  businessId: string;
  placedN: number;
  placedPurchases: number;
  holdoutN: number;
  holdoutPurchases: number;
};

/** What the planner needs: one score per business with history, plus what a business
 * WITHOUT history scores (`lift_global`), which is the «piso para debutantes». */
export type MeritTable = {
  scores: Map<string, number>;
  defaultScore: number;
};

/** A rate with the empty case explicit: no turns is 0, never `NaN` — a `NaN` would
 * propagate through the shrinkage and poison every comparison of the sort. */
function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** `compras_en_ventana / turnos_colocados − compras_en_ventana / turnos_holdout`. */
function liftOf(stats: BusinessTurnStats): number {
  return (
    rate(stats.placedPurchases, stats.placedN) -
    rate(stats.holdoutPurchases, stats.holdoutN)
  );
}

/**
 * Shrinkage towards the platform average (ADR 0066 §3):
 * `(lift · n + globalLift · α) / (n + α)`, with `n = placed_n`.
 *
 * With `n = 0` it returns exactly `globalLift`: a business without history enters in the
 * MIDDLE of the table, not last and not first, and only breaks away as it accumulates
 * turns. With `n = 1` its own number weighs 1/21, which is why `1 de 1` does not beat
 * `40 de 50`.
 */
export function businessScore(
  stats: BusinessTurnStats,
  globalLift: number,
  alpha: number = MERIT_ALPHA,
): number {
  const weight = stats.placedN + alpha;
  if (weight <= 0) return globalLift;
  return (liftOf(stats) * stats.placedN + globalLift * alpha) / weight;
}

/**
 * The platform's average lift, POOLED (ORQUESTADOR: the spec fixes the value with no
 * expired turn — 0 — but not how to aggregate; pooling weighs each business by its
 * volume instead of letting a business with two turns move the prior as much as one with
 * two thousand). With no expired turn anywhere it is 0, and with every business at 0 the
 * order is settled by the FIFO tie-break.
 */
export function globalLift(rows: BusinessTurnStats[]): number {
  const totals = rows.reduce(
    (acc, row) => ({
      businessId: "",
      placedN: acc.placedN + row.placedN,
      placedPurchases: acc.placedPurchases + row.placedPurchases,
      holdoutN: acc.holdoutN + row.holdoutN,
      holdoutPurchases: acc.holdoutPurchases + row.holdoutPurchases,
    }),
    {
      businessId: "",
      placedN: 0,
      placedPurchases: 0,
      holdoutN: 0,
      holdoutPurchases: 0,
    },
  );
  return liftOf(totals);
}

/** Builds what the planner receives: the score of every business with history and the
 * score of every business without it. */
export function buildMeritTable(
  rows: BusinessTurnStats[],
  alpha: number = MERIT_ALPHA,
): MeritTable {
  const average = globalLift(rows);
  const scores = new Map<string, number>();
  for (const row of rows) {
    scores.set(row.businessId, businessScore(row, average, alpha));
  }
  return { scores, defaultScore: average };
}

/**
 * The only DB access of this module: the four counts per business over turns already
 * `done`. A `coupon_redeemed` outcome counts as a purchase — the tick writes it INSTEAD
 * of `purchase` when the coupon was handed over (step 2), so reading only `'purchase'`
 * would count a campaign whose coupon worked as if nobody had come (see the handoff).
 */
export async function loadBusinessTurnStats(): Promise<BusinessTurnStats[]> {
  const bought = sql`${campaignTurns.outcome} in ('purchase', 'coupon_redeemed')`;
  const placed = sql`${campaignTurns.holdout} = false`;
  const held = sql`${campaignTurns.holdout} = true`;
  return await getDb()
    .select({
      businessId: campaignTurns.businessId,
      placedN: sql<number>`count(*) filter (where ${placed})`.mapWith(Number),
      placedPurchases:
        sql<number>`count(*) filter (where ${placed} and ${bought})`.mapWith(
          Number,
        ),
      holdoutN: sql<number>`count(*) filter (where ${held})`.mapWith(Number),
      holdoutPurchases:
        sql<number>`count(*) filter (where ${held} and ${bought})`.mapWith(
          Number,
        ),
    })
    .from(campaignTurns)
    .where(eq(campaignTurns.status, "done"))
    .groupBy(campaignTurns.businessId);
}
