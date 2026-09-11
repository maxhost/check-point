// Barrel del dominio de billing (spec 0063). Dividido por preocupación para quedar dentro
// del presupuesto de tamaño; todo `from "../billing"` resuelve acá.
//
// Fase A: sólo las funciones PURAS. `store.ts` y `webhook.ts` (fase B) y las rutas /
// páginas (fase C) todavía no existen y por eso no se exportan.
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
export { assessEventApplicability, planFromSubscription } from "./derive";
export type {
  AssessEventApplicability,
  EventApplicability,
  IgnoredReason,
  PlanFromSubscription,
  PlanFromSubscriptionArgs,
  SubscriptionRow,
  SubscriptionWrite,
} from "./derive";
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
