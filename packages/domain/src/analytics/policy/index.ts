import { createHash } from "node:crypto";
import { ANALYTICS_POLICY_CONFIG } from "./config";
import {
  ANALYTICS_RULE_DEFINITIONS,
  ANALYTICS_POLICY_LIMITS,
  ANALYTICS_EVALUATOR_VERSION,
  ANALYTICS_TEXT_FIELDS,
} from "./rules";
import {
  validatePolicy,
  type AnalyticsPolicy,
  type AnalyticsPolicyConfig,
  type AnalyticsRuleHandler,
} from "./schema";
export type {
  AnalyticsPolicy,
  AnalyticsPolicyConfig,
  AnalyticsRuleDefinition,
  AnalyticsRulePolicy,
  AnalyticsRuleHandler,
} from "./schema";
export {
  ANALYTICS_RULE_DEFINITIONS,
  ANALYTICS_POLICY_LIMITS,
  ANALYTICS_EVALUATOR_VERSION,
} from "./rules";
export { validatePolicy } from "./schema";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function immutable<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
export function createAnalyticsPolicy(
  config: AnalyticsPolicyConfig,
): AnalyticsPolicy {
  const cloned = structuredClone(config) as AnalyticsPolicy;
  // A snapshot's derived version is not another configuration input.
  const { version: _previousVersion, ...copy } = cloned;
  void _previousVersion;
  validatePolicy(copy, ANALYTICS_RULE_DEFINITIONS);
  return immutable({
    ...copy,
    version: `${copy.revision}:${createHash("sha256")
      .update(
        canonical({
          config: copy,
          definitions: ANALYTICS_RULE_DEFINITIONS,
          structuralLimits: ANALYTICS_POLICY_LIMITS,
          evaluatorVersion: ANALYTICS_EVALUATOR_VERSION,
          templateFields: ANALYTICS_TEXT_FIELDS,
        }),
      )
      .digest("hex")}`,
  });
}
/** One immutable snapshot per process; callers may explicitly inject another validated snapshot. */
export const ANALYTICS_POLICY = createAnalyticsPolicy(ANALYTICS_POLICY_CONFIG);
export function rulesFor(
  policy: AnalyticsPolicy,
  handler: AnalyticsRuleHandler,
) {
  return policy.rules.filter((r) => r.enabled && r.handler === handler);
}
export function policyText(
  policy: AnalyticsPolicy,
  key: string,
  fields: Readonly<Record<string, string | number>> = {},
) {
  const text = policy.texts[key];
  if (text === undefined) throw new Error(`Texto no registrado: ${key}.`);
  return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, name: string) => {
    if (!(name in fields)) throw new Error(`Falta el campo ${name} de ${key}.`);
    return String(fields[name]);
  });
}
export function policyWindows(policy: AnalyticsPolicy) {
  const active = policy.rules.filter((r) => r.enabled);
  const value = (name: string) =>
    Math.max(0, ...active.map((r) => r.parameters[name] ?? 0));
  return {
    recentDays: Math.max(
      policy.weights.averageDailyDays,
      policy.finance.salesDays,
      value("salesDays"),
      value("consumptionDays"),
      value("weeklyDays"),
      value("missingFixedDays"),
      value("comparisonDays") + 1,
    ),
    closedMonths: policy.finance.closedMonths,
    sameWeekdays: value("maximumOccurrences"),
    anomalyDays: Math.max(
      0,
      ...active
        .filter((r) => r.handler === "voids")
        .map(
          (r) => r.parameters.windowDays * (r.parameters.baselineWindows + 1),
        ),
    ),
  };
}
