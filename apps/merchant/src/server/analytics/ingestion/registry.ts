import { SERVER_MODULES } from "../../../modules/server-registry";
import { coreMetricTranslators } from "./core-translators";
export const metricTranslators = () => [
  ...coreMetricTranslators,
  ...Object.values(SERVER_MODULES).flatMap((s) => s.metricTranslators ?? []),
];
export const hasMetricTranslator = (eventType: string) =>
  metricTranslators().some((t) => t.eventType === eventType);
