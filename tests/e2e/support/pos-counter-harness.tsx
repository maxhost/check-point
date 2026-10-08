import { createRoot } from "react-dom/client";
import { PosConsole } from "../../../apps/merchant/src/app/backoffice/pos/pos-console";
import { PosSettings } from "../../../apps/merchant/src/app/backoffice/settings/pos-settings";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { PermissionPicker } from "../../../apps/merchant/src/app/backoffice/staff/permission-picker";
const mode = new URLSearchParams(window.location.search).get("mode");
createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout print:block">
    <BackofficeNavigation
      businessName="Café de prueba"
      isOwner={mode === "settings"}
      permissions={mode === "settings" ? ["pos", "staff"] : ["pos"]}
    />
    <div className="backoffice-content print:m-0 print:p-0">
      {mode === "settings" ? (
        <PosSettings />
      ) : mode === "permissions-off" || mode === "permissions-on" ? (
        <PermissionPicker
          value={[]}
          onChange={() => {}}
          isOwner
          posEnabled={mode === "permissions-on"}
        />
      ) : (
        <PosConsole
          locations={[
            { id: "local-1", name: "Centro" },
            { id: "local-2", name: "Norte" },
          ]}
        />
      )}
    </div>
  </div>,
);
