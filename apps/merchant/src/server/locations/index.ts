// Barrel for the locations domain (spec 0061). Split by concern to stay inside the
// file-size budget; every `from "../locations"` import resolves here.
export {
  LocationError,
  isProviderSelection,
  locationLimitForPlan,
  parseLocationName,
  resolveAddress,
  toLocationDTO,
  FALLBACK_LOCATION_LIMIT,
  PLAN_LOCATION_LIMITS,
} from "./core";
export type {
  AddressInput,
  LocationDTO,
  LocationRow,
  LocationStatus,
  ResolvedAddress,
} from "./core";
export { createLocation, updateLocation } from "./address";
export { listLocations, setLocationStatus } from "./store";
export { parseLocationId } from "./shared";
