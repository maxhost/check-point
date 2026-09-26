import { createRoot } from "react-dom/client";
import CatalogPage from "../../../apps/merchant/src/app/backoffice/catalog/catalog-page";
import { OnboardingChecklist } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-checklist";
import { CatalogTicketProbe } from "./catalog-ticket-probe";
const owner = !new URLSearchParams(window.location.search).has("staff");
createRoot(document.getElementById("root")!).render(
  new URLSearchParams(window.location.search).has("tickets") ? (
    <CatalogTicketProbe />
  ) : (
    <>
      <OnboardingChecklist />
      <CatalogPage canDelete={owner} isOwner={owner} />
    </>
  ),
);
