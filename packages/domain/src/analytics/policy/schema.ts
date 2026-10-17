import type { AnalyticsCardCategory, InboxDecision } from "../types";

export type AnalyticsRuleHandler =
  | "summary"
  | "demand"
  | "goal"
  | "expenses"
  | "cost-rise"
  | "margin"
  | "unknown-cost"
  | "stock"
  | "count-gap"
  | "voids"
  | "customers"
  | "campaign"
  | "slow-day";
export type AnalyticsRuleDefinition = {
  handler: AnalyticsRuleHandler;
  categories: readonly AnalyticsCardCategory[];
  actionKeys: readonly (string | null)[];
  parameters: Readonly<
    Record<string, { minimum: number; maximum?: number; integer?: boolean }>
  >;
};
export type AnalyticsRulePolicy = {
  id: string;
  handler: AnalyticsRuleHandler;
  enabled: boolean;
  category: AnalyticsCardCategory;
  sender: string;
  actionKey: string | null;
  parameters: Readonly<Record<string, number>>;
};
export type AnalyticsPolicyConfig = {
  revision: string;
  weights: {
    minimum: number;
    maximumCards: number;
    noveltyDecay: number;
    maximumPlata: number;
    noSalesDailyMajor: number;
    minimumUrgency: number;
    maximumUrgency: number;
    averageDailyDays: number;
    summaryFixed: number;
  };
  lifetime: { days: number };
  snooze: { noveltyOnDue: "reset" };
  decisions: Readonly<Record<InboxDecision, { label: string }>>;
  categories: Readonly<Record<AnalyticsCardCategory, readonly InboxDecision[]>>;
  operation: {
    evaluationBudgetMs: number;
    evaluationBatchSize: number;
    recentActivityDays: number;
    earliestEvaluationHour: number;
    fallbackWaitMs: number;
    desiredEvaluationMinutes: number;
    cleanupBudgetMs: number;
    cleanupBatchSize: number;
    cleanupWeekday: number;
    cleanupHour: number;
    cleanupMinute: number;
    schedulerTimezone: string;
  };
  rules: readonly AnalyticsRulePolicy[];
  texts: Readonly<Record<string, string>>;
};
export type AnalyticsPolicy = AnalyticsPolicyConfig & {
  readonly version: string;
};

export function validatePolicy(
  config: AnalyticsPolicyConfig,
  registry: readonly AnalyticsRuleDefinition[],
): void {
  const positive = (
    value: number,
    label: string,
    maximum = Number.MAX_SAFE_INTEGER,
    integer = false,
  ) => {
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > maximum ||
      (integer && !Number.isSafeInteger(value))
    )
      throw new Error(`Política inválida: ${label}.`);
  };
  if (!config.revision?.trim())
    throw new Error("Política inválida: falta revision.");
  positive(config.lifetime.days, "lifetime.days", 3650, true);
  positive(config.weights.minimum, "weights.minimum");
  positive(config.weights.maximumCards, "weights.maximumCards", 100, true);
  positive(
    config.weights.averageDailyDays,
    "weights.averageDailyDays",
    3650,
    true,
  );
  for (const key of [
    "noveltyDecay",
    "minimumUrgency",
    "maximumUrgency",
  ] as const)
    positive(config.weights[key], `weights.${key}`, 1);
  if (config.weights.minimumUrgency > config.weights.maximumUrgency)
    throw new Error("Política inválida: urgencias incoherentes.");
  positive(config.weights.maximumPlata, "weights.maximumPlata");
  positive(config.weights.noSalesDailyMajor, "weights.noSalesDailyMajor");
  positive(config.weights.summaryFixed, "weights.summaryFixed");
  if (config.snooze.noveltyOnDue !== "reset")
    throw new Error("Política inválida: recordatorio no soportado.");
  const allowed: Record<AnalyticsCardCategory, readonly InboxDecision[]> = {
    informational: ["seen", "ignore"],
    actionable: ["resolve", "ignore", "snooze"],
    marketing: [],
  };
  for (const category of Object.keys(allowed) as AnalyticsCardCategory[]) {
    const decisions = config.categories[category];
    if (
      !Array.isArray(decisions) ||
      new Set(decisions).size !== decisions.length ||
      decisions.some((d) => !allowed[category].includes(d))
    )
      throw new Error(`Política inválida: decisiones de ${category}.`);
  }
  for (const decision of ["resolve", "ignore", "seen", "snooze"] as const)
    if (!config.decisions[decision]?.label?.trim())
      throw new Error(`Política inválida: decisión ${decision}.`);
  for (const key of [
    "evaluationBudgetMs",
    "evaluationBatchSize",
    "recentActivityDays",
    "fallbackWaitMs",
    "desiredEvaluationMinutes",
    "cleanupBudgetMs",
    "cleanupBatchSize",
  ] as const)
    positive(
      config.operation[key],
      `operation.${key}`,
      Number.MAX_SAFE_INTEGER,
      true,
    );
  for (const [key, maximum] of [
    ["earliestEvaluationHour", 23],
    ["cleanupHour", 23],
    ["cleanupMinute", 59],
    ["cleanupWeekday", 6],
  ] as const)
    if (
      !Number.isSafeInteger(config.operation[key]) ||
      config.operation[key] < 0 ||
      config.operation[key] > maximum
    )
      throw new Error(`Política inválida: operation.${key}.`);
  try {
    new Intl.DateTimeFormat("en", {
      timeZone: config.operation.schedulerTimezone,
    });
  } catch {
    throw new Error("Política inválida: zona del scheduler.");
  }
  for (const key of [
    "action_view_day",
    "action_view_calculation",
    "action_view_customer",
    "action_view_campaign_results",
    "action_edit_product_price",
    "action_view_modules",
  ])
    if (!config.texts[key]?.trim())
      throw new Error(`Política inválida: texto ${key}.`);
  const ids = new Set<string>();
  for (const rule of config.rules) {
    if (!/^[a-zA-Z0-9_-]+$/.test(rule.id) || ids.has(rule.id))
      throw new Error("Política inválida: ID duplicado o inválido.");
    ids.add(rule.id);
    const definition = registry.find((r) => r.handler === rule.handler);
    if (
      !definition ||
      !definition.categories.includes(rule.category) ||
      !registry.some((item) => item.actionKeys.includes(rule.actionKey))
    )
      throw new Error(`Política inválida: referencias de ${rule.id}.`);
    if (rule.handler === "customers" && rule.enabled)
      throw new Error("Política inválida: Marketing está parqueado.");
    if (!rule.sender.trim())
      throw new Error(`Política inválida: remitente de ${rule.id}.`);
    for (const [name, constraint] of Object.entries(definition.parameters)) {
      const value = rule.parameters[name];
      if (
        !Number.isFinite(value) ||
        value < constraint.minimum ||
        value > (constraint.maximum ?? Number.MAX_SAFE_INTEGER) ||
        (constraint.integer && !Number.isSafeInteger(value))
      )
        throw new Error(`Política inválida: ${rule.id}.${name}.`);
    }
    if (
      Object.keys(rule.parameters).some(
        (key) => !(key in definition.parameters),
      )
    )
      throw new Error(
        `Política inválida: parámetro desconocido de ${rule.id}.`,
      );
    if (
      rule.parameters.minimumOccurrences &&
      rule.parameters.maximumOccurrences &&
      rule.parameters.minimumOccurrences > rule.parameters.maximumOccurrences
    )
      throw new Error(`Política inválida: ventanas de ${rule.id}.`);
    if (
      rule.parameters.fastQuantile !== undefined &&
      rule.parameters.slowQuantile !== undefined &&
      rule.parameters.fastQuantile < rule.parameters.slowQuantile
    )
      throw new Error(`Política inválida: cuantiles de ${rule.id}.`);
    if (
      rule.parameters.criticalDays !== undefined &&
      rule.parameters.riskDays !== undefined &&
      rule.parameters.criticalDays > rule.parameters.riskDays
    )
      throw new Error(`Política inválida: riesgo de ${rule.id}.`);
  }
}
