import { createRoot } from "react-dom/client";
import BrandPage from "../../../apps/merchant/src/app/backoffice/brand/brand-page";
import { OnboardingChecklist } from "../../../apps/merchant/src/app/backoffice/onboarding/onboarding-checklist";
import { BrandTicketProbe } from "./brand-ticket-probe";
const owner = !new URLSearchParams(window.location.search).has("staff");
const root = createRoot(document.getElementById("root")!);
window.addEventListener("brand-fixture-unmount", () => root.unmount());
root.render(
  new URLSearchParams(window.location.search).has("tickets") ? (
    <BrandTicketProbe />
  ) : (
    <>
      {owner && <OnboardingChecklist />}
      <BrandPage isOwner={owner} />
    </>
  ),
);
