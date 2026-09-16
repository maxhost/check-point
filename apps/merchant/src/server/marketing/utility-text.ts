/**
 * The UTILITY bag's text (spec 0065 / ADR 0065 §1): the consumer's OWN balance with a
 * business, written for the lock screen. PURE — no DB, no wallet provider, no React.
 *
 * The utility bag is not marketing: it shows the consumer their own state, which is why
 * it is never filtered by the marketing opt-out. The three sentences are the literal
 * ones of the spec; the cap (60) is the cap of THIS text alone — the column
 * `consumer.pass_placement.relevant_text` allows 120 because it also stores the FUSED
 * text (`composeRelevantText`).
 */

/** Spec 0065: «Truncado a 60». Cap of the utility sentence ALONE, not of the column. */
export const UTILITY_TEXT_CAP = 60;

export type UtilityMembership = {
  /** Shown name of the business that owns the program. */
  businessName: string;
  pointsBalance: number;
  stampsCount: number;
};

export type UtilityProgram = {
  /** `core.loyalty_program.kind`: `"points"` | `"stamps"`. */
  kind: string;
  /** RAW `configuration` jsonb. Only `target` is read, and only for Sellos. */
  configuration: unknown;
};

export type UtilityReward = { pointsCost: number | null };

/**
 * Cuts `text` to `cap` characters. An ellipsis (`…`, one character, inside the cap)
 * marks that something was cut, so a truncated sentence never reads as a complete one.
 * ORQUESTADOR: the spec says «truncado a 60» and does not say how — see the handoff.
 */
export function truncateText(text: string, cap: number): string {
  if (cap <= 0) return "";
  if (text.length <= cap) return text;
  return `${text.slice(0, cap - 1).trimEnd()}…`;
}

/**
 * The three cases of the spec, in order:
 *  1. a reward redeemable with the CURRENT balance → «{negocio}: tenes un premio para canjear»;
 *  2. the cheapest reward costs C and the balance B < C → «{negocio}: te faltan {C−B} {unidad}»;
 *  3. no reward at all (or a broken program/reward) → «{negocio}: {B} {unidad}».
 *
 * The cost is read the way `counter/redeem-plan.ts` already reads it: `pointsCost` for
 * Puntos, `configuration.target` for Sellos, both accepted only as an integer ≥ 1 (a
 * numeric string included — `Number("10")`). Anything else is a broken program and falls
 * to case 3: showing a balance is always honest, «tenes un premio» would not be.
 */
export function utilityText(
  membership: UtilityMembership,
  program: UtilityProgram,
  rewards: UtilityReward[],
  cap: number = UTILITY_TEXT_CAP,
): string {
  const stamps = program.kind === "stamps";
  const balance = stamps ? membership.stampsCount : membership.pointsBalance;
  const unit = stamps ? "sellos" : "puntos";
  const cost = stamps
    ? stampsTarget(program.configuration, rewards)
    : cheapestPointsCost(rewards);
  const sentence =
    cost === null
      ? `${membership.businessName}: ${balance} ${unit}`
      : balance >= cost
        ? `${membership.businessName}: tenes un premio para canjear`
        : `${membership.businessName}: te faltan ${cost - balance} ${unit}`;
  return truncateText(sentence, cap);
}

/**
 * Sellos: the card size, raw from `configuration.target`. A Sellos program has exactly
 * one reward (spec 0036), so with no reward row there is nothing to redeem and the text
 * falls back to the plain balance.
 */
function stampsTarget(
  configuration: unknown,
  rewards: UtilityReward[],
): number | null {
  if (rewards.length === 0) return null;
  const raw =
    configuration && typeof configuration === "object"
      ? (configuration as { target?: unknown }).target
      : undefined;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

/** Puntos: the cheapest redeemable reward. `points_cost` is nullable in the DB and its
 * check only says `IS NULL OR > 0`, so a reward without a usable cost is skipped. */
function cheapestPointsCost(rewards: UtilityReward[]): number | null {
  const costs = rewards
    .map((reward) => reward.pointsCost)
    .filter(
      (cost): cost is number => Number.isInteger(cost) && (cost as number) >= 1,
    );
  return costs.length === 0 ? null : Math.min(...costs);
}
