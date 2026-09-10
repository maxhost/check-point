import {
  isSupportedCountryCode,
  verifyLocation,
  type LocationSelection,
} from "../location-providers";

/** Typed domain error: HTTP status + stable machine `code` + user message.
 * Mirrors `CounterError` (`counter/core.ts`) and `StaffError` (`staff.ts`). */
export class LocationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type LocationStatus = "active" | "archived";

/**
 * The ONLY shape of a location that ever reaches the browser (spec 0061, decision 5).
 *
 * It is an allow-list, not a filter: name, address and status, and nothing else. It
 * deliberately omits
 *  - `addressSnapshot` / `providerSnapshot` — raw provider payloads, internal;
 *  - `provider` / `providerPlaceId` / `source` — the CLASS of the location (georeferenced
 *    vs. typed-only) is explicitly NOT shown to the owner;
 *  - `longitude` / `latitude` / `activeVerificationId` — provenance is internal audit.
 * `locations.test.ts` pins this and goes red if a key is added.
 */
export type LocationDTO = {
  id: string;
  name: string;
  addressLabel: string;
  status: LocationStatus;
};

export type LocationRow = {
  id: string;
  name: string;
  addressLabel: string;
  status: string;
};

export function toLocationDTO(row: LocationRow): LocationDTO {
  return {
    id: row.id,
    name: row.name,
    addressLabel: row.addressLabel,
    status: row.status === "archived" ? "archived" : "active",
  };
}

/**
 * Active locations a plan may hold (spec 0061, decision 2). Enforced in the SERVER while
 * holding the business lock, never by hiding a button.
 *
 * `enterprise` is NOT here on purpose: `core.subscription.plan` only ever takes `free` and
 * `plus` today, and the spec forbids writing code for a plan that does not exist. An
 * unknown plan therefore falls back to the most restrictive tier — the consequence to know
 * is that introducing `enterprise` REQUIRES adding its row here, or it lands on 1.
 */
export const PLAN_LOCATION_LIMITS: Record<string, number> = {
  free: 1,
  plus: 3,
};

export const FALLBACK_LOCATION_LIMIT = PLAN_LOCATION_LIMITS.free;

export function locationLimitForPlan(plan: string | null | undefined): number {
  if (typeof plan !== "string") return FALLBACK_LOCATION_LIMIT;
  return PLAN_LOCATION_LIMITS[plan] ?? FALLBACK_LOCATION_LIMIT;
}

const MAX_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 240;

export function parseLocationName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) {
    throw new LocationError(
      422,
      "invalid_input",
      "El nombre del local es obligatorio.",
    );
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new LocationError(
      422,
      "invalid_input",
      `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`,
    );
  }
  return name;
}

/**
 * A location's address, already resolved into ONE of the two classes of decision 3.
 * `owner_typed` carries `longitude: null, latitude: null` — never an approximate point.
 */
export type ResolvedAddress = {
  source: "provider_verified" | "owner_typed";
  provider: "geoapify" | null;
  providerPlaceId: string | null;
  label: string;
  longitude: string | null;
  latitude: string | null;
  countryCode: string;
  snapshot: Record<string, unknown>;
  attribution: string | null;
};

export type AddressInput = {
  label?: unknown;
  provider?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  featureId?: unknown;
};

const isCoordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value);

/**
 * True when the body carries a Geoapify SELECTION (a picked suggestion), i.e. a provider
 * plus both coordinates. Anything else — including `provider: "geoapify"` with missing
 * coordinates — is treated as typed text, so a malformed body can never end up with a
 * fabricated georeference. Pure, so the classification has its own oracle.
 */
export function isProviderSelection(input: AddressInput): boolean {
  return (
    input.provider === "geoapify" &&
    isCoordinate(input.longitude) &&
    isCoordinate(input.latitude)
  );
}

function typedAddress(input: AddressInput, countryCode: string) {
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (!label) {
    throw new LocationError(
      422,
      "invalid_input",
      "La dirección del local es obligatoria.",
    );
  }
  if (label.length > MAX_ADDRESS_LENGTH) {
    throw new LocationError(
      422,
      "invalid_input",
      `La dirección no puede superar ${MAX_ADDRESS_LENGTH} caracteres.`,
    );
  }
  return {
    source: "owner_typed" as const,
    provider: null,
    providerPlaceId: null,
    label,
    // Decision 3: NO forward geocoding of the typed text. A point invented here would
    // look exactly like a verified one and this repo already paid twice for a datum that
    // asserts something untrue (ADR 0054).
    longitude: null,
    latitude: null,
    countryCode,
    snapshot: {},
    attribution: null,
  };
}

/**
 * Resolves the address of the request body into one of the two classes. A Geoapify
 * selection is re-verified SERVER-SIDE with the private key (same `verifyLocation` the
 * onboarding uses): the browser's coordinates are a claim, not a fact.
 */
export async function resolveAddress(
  value: unknown,
  countryCode: string,
): Promise<ResolvedAddress> {
  if (!isSupportedCountryCode(countryCode)) {
    throw new LocationError(
      422,
      "unsupported_country",
      "El país del negocio no está soportado.",
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LocationError(
      422,
      "invalid_input",
      "La dirección del local es obligatoria.",
    );
  }
  const input = value as AddressInput;
  if (!isProviderSelection(input)) return typedAddress(input, countryCode);
  try {
    return await verifyLocation(input as LocationSelection, countryCode);
  } catch (error) {
    throw new LocationError(
      503,
      "address_unverified",
      error instanceof Error
        ? error.message
        : "No pudimos validar la dirección.",
    );
  }
}
