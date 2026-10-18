import { renderBackofficeSeedFixture } from "./backoffice-seed-fixture";
import { SubscriptionConsole } from "../../../apps/merchant/src/app/backoffice/subscription/subscription-console";
import { TrialNotice } from "../../../apps/merchant/src/app/backoffice/subscription/trial-notice";
import { subscriptionOffers } from "../../../apps/merchant/src/server/billing/view";

const query = new URLSearchParams(window.location.search);
const subscription = {
  plan: query.get("plan") ?? "trial",
  status: "active",
  interval: query.get("plan") ? "month" : null,
  pendingPlan: query.has("scheduled") ? "none" : null,
  pendingPlanAt: query.has("scheduled") ? "2026-12-01T12:00:00.000Z" : null,
  trialEndsAt: "2026-12-20T12:00:00.000Z",
};
void renderBackofficeSeedFixture(
  <>
    {query.has("banner") && <TrialNotice />}
    <SubscriptionConsole
      subscription={subscription}
      offers={subscriptionOffers(subscription)}
      facts={{
        renewalAt:
          query.get("plan") === "base" || query.get("plan") === "plus"
            ? "2026-12-01T12:00:00.000Z"
            : null,
        lastPaidInvoice: null,
      }}
      activeLocations={1}
      canCancel
      downgradeBlock={null}
      stripeUnconfirmed={false}
      timezone="America/Guayaquil"
      notice={null}
    />
  </>,
  { businessName: "Café", isOwner: true, permissions: [] },
);
