import { createRoot } from "react-dom/client";
import LoyaltyProgramPage from "../../../apps/merchant/src/app/backoffice/loyalty/loyalty-page";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { TextField } from "../../../apps/merchant/src/ui";
const query = new URLSearchParams(window.location.search);
const owner = !query.has("staff");
const permissions = query.has("no-catalog")
  ? ["loyalty"]
  : ["brand", "catalog", "staff", "locations", "loyalty", "counter"];
createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout">
    <BackofficeNavigation
      businessName="Café"
      isOwner={owner}
      permissions={permissions}
    />
    <div className="backoffice-content">
      <LoyaltyProgramPage
        isOwner={owner}
        canReadCatalog={permissions.includes("catalog")}
      />
    </div>
    <div className="sr-only" id="wizard-reference">
      <TextField label="Referencia wizard" placeholder="Ej.: nombre" />
    </div>
  </div>,
);
