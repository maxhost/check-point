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
// Fase C (D12 / ADR 0061): el claim se mudó a `claim.ts` con su tri-estado. `claimEvent` y
// `ClaimResult` NO se reexportan — su único consumidor es `webhook.ts`, que importa de
// `./claim` directo, y un reexport sin consumidor es andamiaje (`CLAUDE.md`). Lo que sí sale
// por acá es `LEASE_WINDOW_SECONDS`, que leen los dos tests que aseveran la cota inferior de
// la ventana contra el `maxDuration` de la ruta.
// `claimStatement` sale por acá por el mismo motivo que `LEASE_WINDOW_SECONDS`: tiene un
// consumidor real, el test que asevera con `toSQL()` que el `received_at` se escribe con el
// reloj de POSTGRES. No es andamiaje — un reexport sin ningún consumidor sí lo sería.
export { LEASE_WINDOW_SECONDS, claimStatement } from "./claim";
