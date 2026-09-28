import { marketingRequest, asMarketingError } from "./marketing-api";
import type { Location } from "./marketing-types";

/** GET /api/locations is permissioned separately from Marketing. */
export async function readMarketingLocations(canReadLocations: boolean) {
  if (!canReadLocations) return null;
  try {
    const response = await marketingRequest<{ locations: Location[] }>(
      "/api/locations",
    );
    return response.locations;
  } catch (reason) {
    if (asMarketingError(reason).status === 403) return null;
    throw reason;
  }
}
