import { createRoot } from "react-dom/client";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";
import { CounterConsole } from "../../../apps/merchant/src/app/backoffice/counter/counter-console";

createRoot(document.getElementById("root")!).render(
  <div className="backoffice-layout">
    <BackofficeNavigation
      businessName="Panadería de prueba"
      isOwner
      permissions={["counter"]}
    />
    <div className="backoffice-content">
      <CounterConsole
        currencyCode="USD"
        operatorName="Prueba"
        history={[]}
        locations={[{ id: "local-1", name: "Local principal" }]}
      />
    </div>
  </div>,
);
