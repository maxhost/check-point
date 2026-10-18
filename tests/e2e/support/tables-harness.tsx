import { LocationTables } from "../../../apps/merchant/src/modules/tables/ui/location-tables";
import { useEffect, useState } from "react";
import { renderBackofficeSeedFixture } from "./backoffice-seed-fixture";
import { LocationsConsole } from "../../../apps/merchant/src/app/backoffice/locations/locations-console";
import { locationModulePanels } from "../../../apps/merchant/src/app/backoffice/locations/module-panels";
import type { LocationView } from "../../../apps/merchant/src/app/backoffice/locations/location-form";
import { PosConsole } from "../../../apps/merchant/src/modules/pos/ui/pos-console";
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

// `UI_SCREENS` trae pantallas de servidor (no se empaquetan en el navegador): solo los paneles.
const panels = { tables: { screens: {}, locationPanel: LocationTables } };

/** Hace de `page.tsx`: el `router.refresh()` del fixture de navegacion relee `GET /api/locations`
 * y rearma `modulePanels` con la misma funcion que el servidor. */
function LocationsPage() {
  const [serverLocations, setServerLocations] =
    useState<LocationView[]>(locations);
  useEffect(() => {
    const refresh = () =>
      void fetch("/api/locations")
        .then((response) => response.json())
        .then((payload: { locations: LocationView[] }) =>
          setServerLocations(payload.locations),
        )
        .catch(() => undefined);
    window.addEventListener("fixture:router-refresh", refresh);
    return () => window.removeEventListener("fixture:router-refresh", refresh);
  }, []);
  return (
    <LocationsConsole
      initialLocations={serverLocations}
      countryCode="EC"
      activeLimit={3}
      modulePanels={locationModulePanels(serverLocations, panels)}
    />
  );
}

const params = new URLSearchParams(window.location.search);
void renderBackofficeSeedFixture(
  params.get("mode") === "locations" ? (
    <LocationsPage />
  ) : (
    <div className="backoffice-layout">
      <BackofficeNavigation />
      <div className="backoffice-content">
        <PosConsole locations={locations} />
      </div>
    </div>
  ),
  { businessName: "Café", isOwner: true, permissions: ["pos"] },
);
