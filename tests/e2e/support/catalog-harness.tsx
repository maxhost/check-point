import { createRoot } from "react-dom/client";
import CatalogPage from "../../../apps/merchant/src/app/backoffice/catalog/catalog-page";
import { OnboardingChecklist } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-checklist";
import { BackofficeProvider } from "../../../apps/merchant/src/app/backoffice/backoffice-context";
import type { BackofficeInitialContext } from "../../../apps/merchant/src/backoffice-context-contract";
import { CatalogTicketProbe } from "./catalog-ticket-probe";
const owner = !new URLSearchParams(window.location.search).has("staff");
const context: BackofficeInitialContext = {
  version: 1,
  bootId: "catalog-fixture",
  scopeKey: "a".repeat(64),
  userId: "catalog-user",
  emailVerified: true,
  business: {
    id: "catalog-business",
    name: "Catálogo",
    status: "active",
    timezone: "UTC",
    currencyCode: "USD",
  },
  membership: {
    role: owner ? "owner" : "staff",
    status: "active",
    permissions: ["catalog"],
  },
  billing: { access: "trial", trialDaysLeft: 10, trialEndsAt: null },
};
createRoot(document.getElementById("root")!).render(
  new URLSearchParams(window.location.search).has("tickets") ? (
    <CatalogTicketProbe />
  ) : (
    <BackofficeProvider initialContext={context}>
      <OnboardingChecklist />
      <CatalogPage canDelete={owner} isOwner={owner} />
    </BackofficeProvider>
  ),
);
