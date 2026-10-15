import { TicketSettings } from "../../../apps/merchant/src/modules/pos/ui/ticket-settings";
import { createRoot } from "react-dom/client";
import { StockLog } from "../../../apps/merchant/src/modules/stock/ui/stock-log";
import { StaffConsole } from "../../../apps/merchant/src/app/backoffice/staff/staff-console";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { ModuleConfiguration } from "../../../apps/merchant/src/app/backoffice/settings/module-configuration";

const params = new URLSearchParams(location.search);
const surface = params.get("surface");
const isOwner = params.get("role") !== "staff";
const permissions = (params.get("permissions") ?? "").split(",");
createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout">
    <BackofficeNavigation
      businessName="Comercio de prueba"
      isOwner={isOwner}
      permissions={permissions}
    />
    <div className="backoffice-content">
      {surface === "stock" ? (
        <StockLog />
      ) : surface === "staff" ? (
        <StaffConsole />
      ) : surface === "settings" ? (
        <ModuleConfiguration
          panels={[{ moduleId: "pos", content: <TicketSettings /> }]}
        />
      ) : null}
    </div>
  </div>,
);
