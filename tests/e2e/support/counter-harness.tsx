import { renderBackofficeSeedFixture } from "./backoffice-seed-fixture";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { CounterConsole } from "../../../apps/merchant/src/app/backoffice/counter/counter-console";

void renderBackofficeSeedFixture(
  <div className="backoffice-layout">
    <BackofficeNavigation />
    <div className="backoffice-content">
      <CounterConsole
        currencyCode="USD"
        operatorName="Prueba"
        history={[]}
        locations={[{ id: "local-1", name: "Local principal" }]}
      />
    </div>
  </div>,
  {
    businessName: "Panadería de prueba",
    isOwner: true,
    permissions: ["counter"],
  },
);
