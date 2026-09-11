// Barrel del dominio de billing (spec 0063). Dividido por preocupación para quedar dentro
// del presupuesto de tamaño; todo `from "../billing"` resuelve acá.
//
// Fase A: las funciones PURAS. Fase B: la persistencia (`store.ts`) y el webhook
// (`webhook.ts` + `webhook-apply.ts`). Las rutas y páginas (fase C) todavía no existen.
export {
  DEAD_STRIPE_STATUS,
  decidePlanChange,
  hasLiveSubscription,
} from "./plan-change";
export type {
  BlockCode,
  PlanChangeDecision,
  PlanChangeInput,
  PlanIntent,
} from "./plan-change";
export { planFromSubscription } from "./derive";
export type {
  IgnoredReason,
  PlanFromSubscription,
  PlanFromSubscriptionArgs,
  SubscriptionRow,
  SubscriptionWrite,
} from "./derive";
// `assessEventApplicability` se mudó a `applicability.ts` en la fase B (el guard de
// adopción de m1 no entraba en `derive.ts` sin pasar el límite de 300 líneas). El barrel
// reexporta, así que ningún consumidor cambió de import.
export {
  assessEventApplicability,
  canBindSubscriptionId,
} from "./applicability";
export type {
  AssessEventApplicability,
  EventApplicability,
} from "./applicability";
export { planLabel, statusLabel, toSubscriptionView } from "./view";
export type {
  PlanLabel,
  StatusLabel,
  SubscriptionSectionProps,
  SubscriptionView,
  ToSubscriptionView,
} from "./view";
export { asStripeGateway } from "./gateway";
export type { StripeGateway } from "./gateway";
export {
  applySubscriptionState,
  clearPendingPlan,
  readSubscription,
  reconcileFromStripe,
  scheduleDowngrade,
  settleToFree,
} from "./store";
export type { ReconcileOutcome } from "./store";
export { HANDLED_EVENT_TYPES, handleStripeWebhook } from "./webhook";
