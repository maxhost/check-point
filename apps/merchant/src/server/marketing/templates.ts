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
 * group — it escalates (#3 → #5), never goes back (#5 → #3).
 *
 * AT RISK (spec 0105 / ADR 0097): #4 «Cliente en riesgo» sits in the MIDDLE of the
 * reactivation ladder — #3 rank 1 → #4 rank 2 → #5 rank 3 — so a customer pushed with #4
 * no longer gets #3 in that absence but still gets #5 if they stay away. Its audience is
 * the dormant rule AND the habitual who broke their rhythm (`atRisk`, `at-risk.ts`); the
 * 3 visits and the 2× are platform constants, shown by `GET templates` and not editable.
 *
 * BALANCE (spec 0104 / ADR 0096): #7 «Te falta poco» and #8 «Premio sin canjear» are
 * push-only and carry no coupon (`couponAllowed: false`). #7 has the two thresholds
 * (`nearReward`: sellos and % of puntos — the tick applies the one of the program's kind)
 * and the `{faltan}` marker (`message.gapMarker`), mandatory in its message; #8 has its
 * repetition (`repeat`). Their audience lives in `balance-audience.ts`.
 *
 * WELCOME (spec 0107 / ADR 0099): #1+#2 «Bienvenida» goes FIRST. It has NO channel —the
 * gift is issued when the consumer INSTALLS the pass (`welcome-issue.ts`)— and no dormant
 * days; its coupon is MANDATORY (`couponRequired`) and its parameters are `welcome`.
 *
 * The keys are ALSO pinned by the `core_campaign_template_key_check` (migrations `0044`,
 * `0047`, `0048`, `0052`): adding a template here without a migration makes `enable` die on the check.
 */

import type { AtRiskRule } from "./at-risk";

export type TemplateKey =
  | "welcome"
  | "missed_you"
  | "at_risk"
  | "win_back"
  | "near_reward"
  | "unclaimed_reward";

export type CampaignChannel = "proximity" | "push";

export type TemplateGroup = "welcome" | "reactivation" | "balance";

export type WelcomeRedeemFrom = "next_day" | "same_visit";

/** «Bienvenida»'s parameters (spec 0107 §2): validity, reminder, monthly cap, from when. */
export type WelcomeDefinition = {
  validDays: { options: readonly number[]; default: number };
  reminderDays: { options: readonly number[]; default: number };
  monthlyCap: { min: number; max: number; default: number };
  redeemFrom: {
    options: readonly WelcomeRedeemFrom[];
    default: WelcomeRedeemFrom;
  };
};

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
  /** `null` in «Bienvenida»: it has no audience of dormant customers. */
  dormantDays: { options: readonly number[]; default: number } | null;
  /** `gapMarker`: the message admits —and REQUIRES— {@link GAP_MARKER} (only #7). */
  message: { default: string; maxLength: 60; gapMarker: boolean };
  couponRecommended: boolean;
  /** `false` → `enable` refuses any coupon field (400 `couponLabel`). */
  couponAllowed: boolean;
  /** `true` → `enable` refuses a body with no coupon (400 `couponLabel`); only welcome. */
  couponRequired: boolean;
  /** #7's thresholds: at most N sellos, or at most P % of the cost in puntos. */
  nearReward: {
    stamps: { options: readonly number[]; default: number };
    pointsPercent: { options: readonly number[]; default: number };
  } | null;
  /** #8's repetition per absence. */
  repeat: { options: readonly RewardRepeat[]; default: RewardRepeat } | null;
  /** #4's rhythm rule (`at-risk.ts`): informative, fixed by the platform. */
  atRisk: AtRiskRule | null;
  welcome: WelcomeDefinition | null;
};

export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    key: "welcome",
    title: "Bienvenida",
    description:
      "Regala un premio a cada cliente nuevo que instala su pase, para que vuelva.",
    channels: [],
    group: "welcome",
    rank: 1,
    dormantDays: null,
    message: {
      default: "Sumate hoy y en tu próxima visita te llevás un regalo",
      maxLength: 60,
      gapMarker: false,
    },
    couponRecommended: true,
    couponAllowed: true,
    couponRequired: true,
    nearReward: null,
    repeat: null,
    atRisk: null,
    welcome: {
      validDays: { options: [7, 15, 30], default: 15 },
      reminderDays: { options: [1, 3, 7], default: 3 },
      monthlyCap: { min: 1, max: 10000, default: 50 },
      redeemFrom: { options: ["next_day", "same_visit"], default: "next_day" },
    },
  },
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
    couponRequired: false,
    nearReward: null,
    repeat: null,
    atRisk: null,
    welcome: null,
  },
  {
    key: "at_risk",
    title: "Cliente en riesgo",
    description:
      "Busca a los clientes habituales que dejaron de venir con su ritmo de siempre.",
    channels: ["proximity", "push"],
    group: "reactivation",
    rank: 2,
    dormantDays: { options: [14, 30, 45], default: 14 },
    message: {
      default: "Hace unos días que no te vemos. ¡Te esperamos!",
      maxLength: 60,
      gapMarker: false,
    },
    couponRecommended: false,
    couponAllowed: true,
    couponRequired: false,
    nearReward: null,
    repeat: null,
    atRisk: { minVisits: 3, rhythmFactor: 2 },
    welcome: null,
  },
  {
    key: "win_back",
    title: "Recuperar perdidos",
    description:
      "Busca a los clientes que dejaron de venir hace meses, cuando pasan cerca de tu local.",
    channels: ["proximity", "push"],
    group: "reactivation",
    rank: 3,
    dormantDays: { options: [60, 90, 180], default: 90 },
    message: {
      default: "¡Volvé! Te estamos esperando.",
      maxLength: 60,
      gapMarker: false,
    },
    couponRecommended: true,
    couponAllowed: true,
    couponRequired: false,
    nearReward: null,
    repeat: null,
    atRisk: null,
    welcome: null,
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
    couponRequired: false,
    nearReward: {
      stamps: { options: [1, 2, 3], default: 2 },
      pointsPercent: { options: [10, 20], default: 20 },
    },
    repeat: null,
    atRisk: null,
    welcome: null,
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
    couponRequired: false,
    nearReward: null,
    repeat: { options: ["once", "every_30_days"], default: "once" },
    atRisk: null,
    welcome: null,
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
