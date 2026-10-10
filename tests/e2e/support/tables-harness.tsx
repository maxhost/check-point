import { createRoot } from "react-dom/client";
import { LocationsConsole } from "../../../apps/merchant/src/app/backoffice/locations/locations-console";
import { PosConsole } from "../../../apps/merchant/src/app/backoffice/pos/pos-console";
import { BackofficeNavigation } from "../../../apps/merchant/src/app/backoffice/backoffice-navigation";

export const locations = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    name: "Centro",
    addressLabel: "Av. Central",
    status: "active" as const,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    name: "Norte",
    addressLabel: "Av. Norte",
    status: "active" as const,
  },
];
const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")!).render(
  params.get("mode") === "locations" ? (
    <LocationsConsole
      initialLocations={locations}
      countryCode="EC"
      activeLimit={3}
    />
  ) : (
    <div className="backoffice-layout">
      <BackofficeNavigation businessName="Café" isOwner permissions={["pos"]} />
      <div className="backoffice-content">
        <PosConsole locations={locations} />
      </div>
    </div>
  ),
);
