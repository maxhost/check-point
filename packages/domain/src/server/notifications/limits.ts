import { RELEVANT_TEXT_CAP } from "../marketing/relevant-text";

/**
 * THE LIMITS OF NOTIFICATIONS, IN ONE PLACE (spec 0141 / ADR 0115 §5). This is the ONLY
 * file where a notification limit is changed: the modules that apply them
 * (`push-budget.ts`, `push.ts`, `reminder.ts`, the marketing templates, `placement-plan.ts`)
 * import from here and re-export under the same name. No logic lives here, only values.
 *
 * It is also the door for per-business limits (owner, ADR 0115 §5: «la idea es que cada
 * comercio tenga su limite»), which are NOT decided yet. The map of where every limit is,
 * what it limits and who reads it: `docs/notificaciones/README.md`.
 *
 * Changing a value: edit it here AND its literal in `limits.test.ts` — that test pins every
 * value against a literal on purpose, so a change is never silent.
 *
 * This module imports none of its readers (no cycles); `RELEVANT_TEXT_CAP` comes from
 * `relevant-text.ts`, which does not import back.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// ── The 24 h notice budget (spec 0111 D2 / ADR 0103 §3), read by `decideBudget` ──────────
//
// The counter (`transactional`: accredit, redeem a reward, redeem a coupon) rings at most
// COUNTER_NOTICES_PER_24H times; the next ones are credited in silence. Nothing rings more
// than NOTIFYING_PER_24H times, adding every class up. «With sound» = a `wallet_push_queue`
// row `sent` of class `transactional`, `campaign` or `reminder`, in the moving window of
// BUDGET_WINDOW_MS. `pass_refresh` is silent: it never counts and is never held back. Web
// Push counts like Wallet (the owner spoke of notifications, not of a channel).

/** Counter notices with sound per consumer in 24 h. Read by `decideBudget` (`push-budget.ts`). */
export const COUNTER_NOTICES_PER_24H = 2;
/**
 * Notices with sound per consumer in 24 h, every class added up. Read by `decideBudget`.
 * It was born as Google Wallet's cap (3 notifying messages per pass every 24 h, and the pass
 * is ONE for the whole network); since ADR 0115 §5 the 3 is KEPT by decision of the owner
 * and is no longer derived from Google's cap.
 */
export const NOTIFYING_PER_24H = 3;
/** The moving window of the budget. Read by `decideBudget` and `loadBudget` (`push-budget-store.ts`). */
export const BUDGET_WINDOW_MS = 24 * HOUR_MS;

// ── Spacing between two pushes to the same consumer (ADR 0037) ───────────────────────────

/** Minimum spacing between two pushes to the same consumer, in minutes (env override kept). Read by `push.ts`. */
export const COOLDOWN_MINUTES = Number(
  process.env.WALLET_PUSH_COOLDOWN_MINUTES ?? 3,
);
/** {@link COOLDOWN_MINUTES} in ms. Read by `push.ts` (and its backoff) and `push-worker.ts`. */
export const COOLDOWN_MS = COOLDOWN_MINUTES * MINUTE_MS;

// ── The day-without-purchase reminder (spec 0111 D6), read by `reminder.ts` ──────────────

/** No reminder at or after 21:00 local (owner, 2026-09-29): it waits for the next day. Read by `decideReminder`. */
export const REMINDER_CUTOFF_MINUTE = 21 * 60;
/** The target is clamped to [9:00, 20:30] local, so it always leaves 30 minutes before
 * the cutoff (the worker runs every 5 min). Read by `reminderTargetMinute`. */
export const REMINDER_EARLIEST_MINUTE = 9 * 60;
/** Upper end of that clamp. Read by `reminderTargetMinute`. */
export const REMINDER_LATEST_MINUTE = REMINDER_CUTOFF_MINUTE - 30;
/** At most one reminder per consumer in this span (any status). Read by `decideReminder` and `reminder-store.ts`. */
export const REMINDER_SPACING_MS = 20 * HOUR_MS;

// ── Monthly caps of claimed coupons, per campaign (the merchant picks within min–max) ────

/** «Bienvenida» (spec 0099). Read by `TEMPLATES` (`templates.ts`). */
export const WELCOME_MONTHLY_CAP = { min: 1, max: 10000, default: 50 };
/** «Oferta cruzada» (spec 0136; «Bienvenida»'s cap). Read by `CROSS_TEMPLATE` (`cross-rules.ts`). */
export const CROSS_MONTHLY_CAP = { min: 1, max: 10000, default: 50 };
/** «Horas valle» (spec 0113; turned off by spec 0138). Read by `VALLEY_TEMPLATE` (`valley-rules.ts`). */
export const VALLEY_MONTHLY_CAP = { min: 1, max: 10000, default: 50 };

// ── Venta cruzada: la loteria (spec 0143 / ADR 0117 §12-§13), read by `cross-lottery.ts` ──
//
// After an accreditation in A, ONE eligible cross campaign is drawn with
// `p_i = ε/k + (1 − ε) · c_i·a_i·b_i / Σ c_j·a_j·b_j` (the formula lives in `cross-lottery.ts`).

/** ε: the share drawn evenly among the eligible ones (owner, ADR 0117 §13: «20 % editable»). */
export const CROSS_LOTTERY_EPSILON = 0.2;
/** Closeness `c = e^(−d / DECAY)`, d in meters to B's nearest location (orchestrator's value). */
export const CROSS_LOTTERY_DECAY_METERS = 1000;
/** Lower end of the «behind» factor `a = (1 + F) / (1 + R)` (orchestrator's value). */
export const CROSS_LOTTERY_BEHIND_MIN = 0.5;
/** Upper end of that clamp (orchestrator's value). */
export const CROSS_LOTTERY_BEHIND_MAX = 2;
/** The H4 bonus to a business with no new customer in its local month (orchestrator's value). */
export const CROSS_LOTTERY_NEW_CUSTOMER_BONUS = 1.5;
/** The policy's name, recorded in every decision (`core.cross_decision.policy`). */
export const CROSS_LOTTERY_POLICY = "h4-v1";

// ── Proximity on the pass (spec 0065 / ADR 0066; turned off by spec 0138) ────────────────

/** Every number of the design is a PARAMETER, so a test can lower it instead of seeding
 * fifty rows. Defaults are the ORQUESTADOR's (spec 0065 / ADR 0066). */
export type PlacementLimits = {
  maxActiveTurns: number;
  businessQuota: number;
  minSeparationMeters: number;
  holdoutRate: number;
  cooldownDays: number;
  utilitySlots: number;
  windowDays: number;
  /** Hard ceiling of the pass: Apple accepts 10 `locations`, Google 10 per object. */
  maxSlots: number;
  textCap: number;
};

/** Read by `planConsumerPlacement` (`placement-plan.ts`), `tick.ts`, `audience-preview.ts` and `composer-summary.ts`. */
export const DEFAULT_PLACEMENT_LIMITS: PlacementLimits = {
  maxActiveTurns: 5,
  businessQuota: 50,
  minSeparationMeters: 400,
  holdoutRate: 0.1,
  cooldownDays: 30,
  utilitySlots: 3,
  windowDays: 5,
  maxSlots: 10,
  textCap: RELEVANT_TEXT_CAP,
};
