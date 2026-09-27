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
 * The keys are ALSO pinned by the `core_campaign_template_key_check` of the migration
 * `0044`: adding a template here without a migration makes `enable` die on the check.
 */

export type TemplateKey = "missed_you" | "win_back";

export type TemplateDefinition = {
  key: TemplateKey;
  /** Also the `name` of the campaign it creates. */
  title: string;
  description: string;
  channel: "proximity";
  dormantDays: { options: readonly number[]; default: number };
  message: { default: string; maxLength: 60 };
  couponRecommended: boolean;
};

export const TEMPLATES: readonly TemplateDefinition[] = [
  {
    key: "missed_you",
    title: "Te extrañamos",
    description:
      "Le recuerda tu local a los clientes que hace un tiempo no vienen, cuando pasan cerca.",
    channel: "proximity",
    dormantDays: { options: [14, 30], default: 30 },
    message: {
      default: "Hace rato no te vemos. ¡Te esperamos!",
      maxLength: 60,
    },
    couponRecommended: false,
  },
  {
    key: "win_back",
    title: "Recuperar perdidos",
    description:
      "Busca a los clientes que dejaron de venir hace meses, cuando pasan cerca de tu local.",
    channel: "proximity",
    dormantDays: { options: [60, 90, 180], default: 90 },
    message: { default: "¡Volvé! Te estamos esperando.", maxLength: 60 },
    couponRecommended: true,
  },
];

/** The template of a key, or `null` for anything outside the catalog (→ 404). */
export function templateByKey(key: string): TemplateDefinition | null {
  return TEMPLATES.find((template) => template.key === key) ?? null;
}
