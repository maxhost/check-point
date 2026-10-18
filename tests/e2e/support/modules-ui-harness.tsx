import { TicketSettings } from "../../../apps/merchant/src/modules/pos/ui/ticket-settings";
import { renderBackofficeSeedFixture } from "./backoffice-seed-fixture";
import { StockLog } from "../../../apps/merchant/src/modules/stock/ui/stock-log";
import { StaffConsole } from "../../../apps/merchant/src/app/backoffice/staff/staff-console";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { ModuleConfiguration } from "../../../apps/merchant/src/app/backoffice/settings/module-configuration";

const params = new URLSearchParams(location.search);
const surface = params.get("surface");
const isOwner = params.get("role") !== "staff";
const permissions = (params.get("permissions") ?? "").split(",");
void renderBackofficeSeedFixture(
  <div className="backoffice-layout">
    <BackofficeNavigation />
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
  {
    businessName: "Comercio de prueba",
    isOwner: isOwner,
    permissions: permissions,
  },
);
