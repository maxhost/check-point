/**
 * THE CATALOG OF PREBUILT CAMPAIGNS (spec 0101 / ADR 0091 / ADR 0092). PURE: it is
 * product, versioned with the deploy, not rows of the database.
 *
 * A template is ONE decision the merchant does not have to make: the kind, the name and
 * a sensible default for every parameter. Turning it on creates and activates a
 * `core.campaign` with `template_key` in one step (`template-store.ts`); its parameters
 * stay FROZEN while it runs (ADR 0092 §3).
 *
 * The day options are the owner's (#3: 14/30, #5: 60/90/180, 2026-09-26). The texts
 * (`description`, `message.default`) are the ORCHESTRATOR's and change without a spec.
 * The pass already prefixes the business name to the message (`composeRelevantText`,
 * `relevant-text.ts`), which is why no default includes it.
 *
 * CHANNELS AND GROUPS (spec 0103 / ADR 0095): a template runs by proximity, push or both
 * (the merchant picks among `channels` at `enable`). `group`/`rank` are the platform's
 * fixed overlap groups for the PUSH channel: a template is not pushed to a consumer who,
 * since their last visit, already had a push of it or of a HIGHER-OR-EQUAL rank of its
 * group — it escalates (#3 → #5), never goes back (#5 → #3). The #4 of spec C will be
 * rank 3 of `reactivation`.
 *
 * BALANCE (spec 0104 / ADR 0096): #7 «Te falta poco» and #8 «Premio sin canjear» are
 * push-only and carry no coupon (`couponAllowed: false`). #7 has the two thresholds
 * (`nearReward`: sellos and % of puntos — the tick applies the one of the program's kind)
 * and the `{faltan}` marker (`message.gapMarker`), mandatory in its message; #8 has its
 * repetition (`repeat`). Their audience lives in `balance-audience.ts`.
 *
 * The keys are ALSO pinned by the `core_campaign_template_key_check` (migrations `0044`,
 * `0047`): adding a template here without a migration makes `enable` die on the check.
 */

export type TemplateKey =
  | "missed_you"
  | "win_back"
  | "near_reward"
  | "unclaimed_reward";

export type CampaignChannel = "proximity" | "push";

export type TemplateGroup = "reactivation" | "balance";

export type RewardRepeat = "once" | "every_30_days";

/** The marker #7's message carries, replaced per consumer by what they lack. */
export const GAP_MARKER = "{faltan}";

export type TemplateDefinition = {
  key: TemplateKey;
  /** Also the `name` of the campaign it creates. */
  title: string;
  description: string;
  channels: readonly CampaignChannel[];
  group: TemplateGroup;
  /** Higher = further along the group's escalation (see the file comment). */
  rank: number;
  dormantDays: { options: readonly number[]; default: number };
  /** `gapMarker`: the message admits —and REQUIRES— {@link GAP_MARKER} (only #7). */
  message: { default: string; maxLength: 60; gapMarker: boolean };
  couponRecommended: boolean;
  /** `false` → `enable` refuses any coupon field (400 `couponLabel`). */
  couponAllowed: boolean;
  /** #7's thresholds: at most N sellos, or at most P % of the cost in puntos. */
  nearReward: {
    stamps: { options: readonly number[]; default: number };
    pointsPercent: { options: readonly number[]; default: number };
  } | null;
  /** #8's repetition per absence. */
  repeat: { options: readonly RewardRepeat[]; default: RewardRepeat } | null;
};

export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    key: "missed_you",
    title: "Te extrañamos",
    description:
      "Le recuerda tu local a los clientes que hace un tiempo no vienen, cuando pasan cerca.",
    channels: ["proximity", "push"],
    group: "reactivation",
    rank: 1,
    dormantDays: { options: [14, 30], default: 30 },
    message: {
      default: "Hace rato no te vemos. ¡Te esperamos!",
      maxLength: 60,
      gapMarker: false,
    },
    couponRecommended: false,
    couponAllowed: true,
    nearReward: null,
    repeat: null,
  },
  {
    key: "win_back",
    title: "Recuperar perdidos",
    description:
      "Busca a los clientes que dejaron de venir hace meses, cuando pasan cerca de tu local.",
    channels: ["proximity", "push"],
    group: "reactivation",
    rank: 2,
    dormantDays: { options: [60, 90, 180], default: 90 },
    message: {
      default: "¡Volvé! Te estamos esperando.",
      maxLength: 60,
      gapMarker: false,
    },
    couponRecommended: true,
    couponAllowed: true,
    nearReward: null,
    repeat: null,
  },
  {
    key: "near_reward",
    title: "Te falta poco",
    description:
      "Avisa por notificación a los clientes que no vienen y están a poco de su premio.",
    channels: ["push"],
    group: "balance",
    rank: 1,
    dormantDays: { options: [3, 7, 14], default: 7 },
    message: {
      default: "¡Estás a {faltan} de tu premio!",
      maxLength: 60,
      gapMarker: true,
    },
    couponRecommended: false,
    couponAllowed: false,
    nearReward: {
      stamps: { options: [1, 2, 3], default: 2 },
      pointsPercent: { options: [10, 20], default: 20 },
    },
    repeat: null,
  },
  {
    key: "unclaimed_reward",
    title: "Premio sin canjear",
    description:
      "Avisa por notificación a los clientes que ya tienen un premio y no vuelven a canjearlo.",
    channels: ["push"],
    group: "balance",
    rank: 2,
    dormantDays: { options: [7, 14, 30], default: 14 },
    message: {
      default: "Tenés un premio esperándote. ¡Vení a canjearlo!",
      maxLength: 60,
      gapMarker: false,
    },
    couponRecommended: false,
    couponAllowed: false,
    nearReward: null,
    repeat: { options: ["once", "every_30_days"], default: "once" },
  },
];

/** The template of a key, or `null` for anything outside the catalog (→ 404). */
export function templateByKey(key: string): TemplateDefinition | null {
  return TEMPLATES.find((template) => template.key === key) ?? null;
}

/**
 * The keys whose push BLOCKS a push of `template` (spec 0103 §2): the same group, rank
 * greater than or EQUAL — the template itself included, so the same campaign is not
 * pushed twice in one absence.
 */
export function templateKeysAtOrAbove(
  template: Pick<TemplateDefinition, "group" | "rank">,
): TemplateKey[] {
  return TEMPLATES.filter(
    (other) => other.group === template.group && other.rank >= template.rank,
  ).map((other) => other.key);
}
