// Barrel del dominio de billing (spec 0063). Dividido por preocupación para quedar dentro
// del presupuesto de tamaño; todo `from "../billing"` resuelve acá.
//
// Fase A: las funciones PURAS. Fase B: la persistencia (`store.ts`) y el webhook
// (`webhook.ts` + `webhook-apply.ts`). Fase C (ADR 0061): el tri-estado del claim. Fase D:
// las rutas de `app/api/billing/**` (D1, servidor) y las páginas del backoffice (D2, UI).
// La renumeración importa al leer comentarios viejos: lo que antes de 2026-09-11 se llamaba
// «fase C» es la D.
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
export {
  planLabel,
  planWithInterval,
  statusLabel,
  subscriptionOffers,
  toSubscriptionView,
} from "./view";
export type {
  PlanLabel,
  StatusLabel,
  SubscriptionOffers,
  SubscriptionSectionProps,
  SubscriptionView,
  ToSubscriptionView,
} from "./view";
export { asStripeGateway } from "./gateway";
export type { StripeGateway } from "./gateway";
// Spec 0064, A4: la fecha de renovación y la última factura pagada. No tocan la base — se
// leen de Stripe en cada render y nunca tiran.
export {
  NO_BILLING_FACTS,
  readBillingFacts,
  toBillingFactsView,
} from "./facts";
export type { BillingFacts, BillingFactsView, LastPaidInvoice } from "./facts";
export {
  applySubscriptionState,
  clearPendingPlan,
  readSubscription,
  scheduleDowngrade,
  settleToFree,
} from "./store";
// D8 salió de `store.ts` al entrar el freno defensivo de la spec 0065 (límite de 300
// líneas). Sigue saliendo por este barrel: sus consumidores no cambiaron.
export { reconcileFromStripe } from "./reconcile";
export type { ReconcileOutcome } from "./reconcile";
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
