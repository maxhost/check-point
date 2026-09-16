/**
 * The results DTO of one campaign (spec 0065, «Resultados»), PURE: `results-store.ts`
 * loads the facts and this file turns them into what the screen reads. Splitting it is
 * the module's idiom (`audience.ts` / `audience-store.ts`) and it is what lets the
 * gating of the estimate be pinned by a unit test instead of by a seeded database.
 *
 * Every block carries its QUALITY (ADR 0021). Three of the ADR's four values appear
 * here — `observada`, `estimado_configurado`, `no_disponible` — plus `estimada`, which
 * spec 0065 introduces for the lift line and the ADR does not list. It is NOT a synonym
 * of the other two: an observed count is a fact, a configured estimate is arithmetic
 * over a cost the owner declared, and `estimada` is an inference from a control group.
 * Naming them apart is the whole point of the ADR — «la UI no estima ni sustituye una
 * fuente no disponible».
 */

/**
 * The literal title of the purchases block, in the DTO and not in the screen, because
 * it is a PRODUCT guarantee and not decoration: the spec says it must read «compraron
 * durante su ventana» and «nunca "generados por la campaña"». A turn placed on a
 * consumer who was coming back anyway also lands here — that is exactly why the holdout
 * exists and why this title may not claim causation.
 */
export const WINDOW_PURCHASES_TITLE = "Compraron durante su ventana";

/** Holdout turns needed before the effect estimate is shown at all (spec 0065). */
export const MIN_HOLDOUT_FOR_ESTIMATE = 30;

export type Quality =
  | "observada"
  | "estimada"
  | "estimado_configurado"
  | "no_disponible";

/** The last row of `core.campaign_tick_audience` for this campaign. `null` when the
 * tick has not run since the campaign was activated: there is no photo to show, and
 * showing zeros would read as «nobody qualified» instead of «not measured yet». */
export type AudiencePhoto = {
  ranAt: Date;
  total: number;
  reachable: number;
  noLocation: number;
  optOut: number;
  cooldown: number;
};

/** `held` is every `holdout` turn whatever its status — the withheld group as the owner
 * sees it. It is NOT `window.holdoutN`, which counts only the ones already `done`: a
 * holdout whose window is still open has not had its chance yet and cannot be part of a
 * rate. Two numbers, two names, on purpose. */
export type TurnTally = {
  queued: number;
  active: number;
  done: number;
  cancelled: number;
  held: number;
};

/**
 * Purchases inside the window, counted over turns already `done` and with the SAME
 * definition of «bought» that the queue's merit uses (`marketing/merit.ts`):
 * `outcome in ('purchase','coupon_redeemed')`. Reading only `'purchase'` here would
 * show a campaign whose coupon worked as if nobody had come, and would also make the
 * screen disagree with the order of the queue for the same campaign.
 */
export type WindowFacts = {
  placedN: number;
  placedPurchases: number;
  holdoutN: number;
  holdoutPurchases: number;
};

export type LocationRow = {
  locationId: string;
  name: string;
  turns: number;
  windowPurchases: number;
  redemptions: number;
};

export type CouponFacts = {
  label: string | null;
  cap: number | null;
  redeemed: number;
  /** `sum(cost_snapshot)` as the driver returns numeric: a STRING, never a float. */
  incurredCost: string | null;
};

export type ResultsFacts = {
  audience: AudiencePhoto | null;
  turns: TurnTally;
  window: WindowFacts;
  coupon: CouponFacts;
  byLocation: LocationRow[];
  /** Per BUSINESS, not per campaign: «estás en el pase de K de tus C clientes». */
  passReach: { inPass: number; members: number };
};

export type EffectLine =
  | { quality: "estimada"; extraCustomers: number }
  | { quality: "no_disponible"; holdoutN: number; needed: number };

export type CampaignResults = {
  audience: { quality: Quality; photo: AudiencePhoto | null };
  turns: { quality: Quality } & TurnTally;
  windowPurchases: {
    quality: Quality;
    title: string;
    placed: { purchases: number; of: number };
    held: { purchases: number; of: number };
  };
  effect: EffectLine;
  coupon: { quality: Quality } & CouponFacts;
  byLocation: { quality: Quality; rows: LocationRow[] };
  passReach: { quality: Quality; inPass: number; members: number };
};

/** A rate with the empty case explicit — same guard as `merit.ts`: with no turns the
 * answer is 0, never `NaN`, which would travel to the screen as «NaN clientes». */
function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * `(x/A − y/B) × A`, and ONLY with `B ≥ 30` (spec 0065). Below that the answer is not
 * a smaller number, it is `no_disponible`: with a handful of held turns the difference
 * of two rates is noise, and a «+4 clientes» built on 3 holdouts is a number the owner
 * would act on. The screen says «todavía sin señal» and shows nothing else.
 *
 * It can come out NEGATIVE, and it is returned as such: a campaign whose placed group
 * bought LESS than the control is telling the owner something true.
 *
 * ROUNDED to one decimal, and that is not cosmetics: this is a DIFFERENCE OF TWO RATES
 * times a count, so IEEE noise is the normal case, not the edge — `10/100 − 20/50` times
 * 100 is `-30.000000000000004`, measured. Rounding here and not in the screen is
 * deliberate: the DTO is what the results test reads, and leaving the noise in would
 * force every consumer of this number to invent its own precision.
 *
 * ORQUESTADOR, not the owner: the spec writes «+Z clientes» without fixing a precision.
 * One decimal and not a whole number because with the floor at 30 holdouts a real but
 * small effect exists, and `Math.round` would print it as «+0 clientes» — which reads as
 * «no sirvió» instead of «sirvió poco».
 */
export function estimateEffect(window: WindowFacts): EffectLine {
  if (window.holdoutN < MIN_HOLDOUT_FOR_ESTIMATE)
    return {
      quality: "no_disponible",
      holdoutN: window.holdoutN,
      needed: MIN_HOLDOUT_FOR_ESTIMATE,
    };
  const lift =
    rate(window.placedPurchases, window.placedN) -
    rate(window.holdoutPurchases, window.holdoutN);
  return {
    quality: "estimada",
    extraCustomers: Math.round(lift * window.placedN * 10) / 10,
  };
}

export function buildCampaignResults(facts: ResultsFacts): CampaignResults {
  return {
    audience: { quality: "observada", photo: facts.audience },
    turns: { quality: "observada", ...facts.turns },
    windowPurchases: {
      quality: "observada",
      title: WINDOW_PURCHASES_TITLE,
      placed: {
        purchases: facts.window.placedPurchases,
        of: facts.window.placedN,
      },
      held: {
        purchases: facts.window.holdoutPurchases,
        of: facts.window.holdoutN,
      },
    },
    effect: estimateEffect(facts.window),
    // The redeemed COUNT is observed; the money is `estimado_configurado` (ADR 0021):
    // it is the cost the owner declared, never a credited sale. They travel in one
    // block because the screen shows them in one line («n / tope · $X»), and the
    // weaker of the two qualities is the one that must be displayed.
    coupon: { quality: "estimado_configurado", ...facts.coupon },
    byLocation: { quality: "observada", rows: facts.byLocation },
    passReach: { quality: "observada", ...facts.passReach },
  };
}
