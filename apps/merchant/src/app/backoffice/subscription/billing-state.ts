import type { SubscriptionView } from "../../../server/billing/view";

/** Contrato HTTP 0189 §D10; nunca incluye identificadores de Stripe. */
export type BillingState = {
  subscription: SubscriptionView;
  access: "trial" | "subscribed" | "blocked";
  trialDaysLeft: number | null;
  activeLocations: number;
  activeCampaignsOutsideBase: number;
  prices: Record<"base" | "plus", Record<"month" | "year", number>>;
  currency: string;
};

export function billingPlanName(plan: string) {
  if (plan === "base") return "Conecta";
  if (plan === "plus") return "Impulso";
  if (plan === "trial") return "Prueba de 90 días";
  if (plan === "none") return "Sin plan";
  return "Plan no disponible";
}
