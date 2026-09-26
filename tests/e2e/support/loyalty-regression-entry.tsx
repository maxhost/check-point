import { createRoot } from "react-dom/client";
import BrandPage from "../../../apps/merchant/src/app/backoffice/brand/brand-page";
import CatalogPage from "../../../apps/merchant/src/app/backoffice/catalog/catalog-page";
import { StaffConsole } from "../../../apps/merchant/src/app/backoffice/staff/staff-console";
import { LocationsConsole } from "../../../apps/merchant/src/app/backoffice/locations/locations-console";
const surface = new URLSearchParams(location.search).get("surface");
createRoot(document.getElementById("root")!).render(
  surface === "brand" ? (
    <BrandPage />
  ) : surface === "catalog" ? (
    <CatalogPage canDelete isOwner />
  ) : surface === "staff" ? (
    <StaffConsole />
  ) : (
    <LocationsConsole initialLocations={[]} countryCode="EC" activeLimit={10} />
  ),
);
