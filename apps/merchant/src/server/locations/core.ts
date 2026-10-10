import {
  ENTITLEMENTS,
  limitOf,
  type EntitlementContext,
} from "@mi-pasaporte/domain/server/entitlements/index";
import { isSupportedCountryCode } from "../supported-countries";
import { SelectionError, verifySelection } from "../places/selection-token";

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
 * Spec 0072 §D2.5 + spec 0189 §D2 — ENVOLTORIOS FINOS sobre la capa de entitlements. Los topes
 * por plan NO viven acá: la fuente es `entitlements/catalog.ts`, entrada `locations.max`.
 *
 * Sigue enforced en el SERVER mientras se sostiene el lock del negocio, nunca escondiendo
 * un botón (spec 0061, decisión 2).
 */
export const FALLBACK_LOCATION_LIMIT: number =
  ENTITLEMENTS["locations.max"].fallback;

/**
 * El tope EFECTIVO de locales (spec 0189 §D2): el del PLAN EFECTIVO de la fila — `trial` con
 * la prueba vigente, el plan pago con suscripción viva, `none` (1) sin acceso o sin fila. La
 * cancelación programada (`pending_plan='none'`) ya NO baja el tope: el negocio usa lo pagado
 * hasta el fin del periodo (ADR 0134 §8). Acepta la fila de un `leftJoin` (columnas
 * nulas = sin fila de suscripción → fail-closed).
 */
export function effectiveLocationLimit(
  row: NullableRow<Omit<EntitlementContext, "now">> | null | undefined,
  now: Date,
): number {
  if (!row || row.plan == null || row.status == null) {
    return limitOf(null, "locations.max");
  }
  return limitOf(
    {
      plan: row.plan,
      status: row.status,
      stripeSubscriptionId: row.stripeSubscriptionId ?? null,
      trialEndsAt: row.trialEndsAt ?? null,
      now,
    },
    "locations.max",
  );
}

type NullableRow<T> = { [K in keyof T]: T[K] | null };

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
 * `provider` is what this code WRITES: `"google"` (spec 0155) or null. Rows written before
 * the spec keep `provider = 'geoapify'`; no read path types that column.
 */
export type ResolvedAddress = {
  source: "provider_verified" | "owner_typed";
  provider: "google" | null;
  providerPlaceId: string | null;
  label: string;
  longitude: string | null;
  latitude: string | null;
  countryCode: string;
  snapshot: Record<string, unknown>;
  attribution: string | null;
};

/** Contrato 0155 «Locales del backoffice»: `selectionToken` = a Google place picked through
 * `POST /api/places/details`; without it the `label` is typed text. */
export type AddressInput = {
  label?: unknown;
  selectionToken?: unknown;
};

/**
 * True when the body carries a picked place (a non-empty `selectionToken`). Its signature
 * is checked by `resolveAddress`, not here: a token that is present but bad is a 422, never
 * a silent fall back to typed text. Pure, so the classification has its own oracle.
 */
export function isProviderSelection(input: AddressInput): boolean {
  return (
    typeof input.selectionToken === "string" && input.selectionToken.length > 0
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
 * Resolves the address of the request body into one of the two classes. A picked place is
 * a SIGNED selection (`places/selection-token.ts`): the server trusts only what it signed
 * itself in `/api/places/details`, so the browser's coordinates and `label` are ignored.
 * No network call happens here (ADR 0121 §11).
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
  let selection;
  try {
    selection = verifySelection(input.selectionToken);
  } catch (error) {
    if (!(error instanceof SelectionError)) throw error;
    throw new LocationError(422, "invalid_selection", error.message);
  }
  // `location.country_code` has no FK or check against the business: this comparison is
  // the only thing that keeps a branch in another country out.
  if (selection.countryCode !== countryCode) {
    throw new LocationError(
      422,
      "address_country_mismatch",
      "Esa dirección está en otro país que tu negocio.",
    );
  }
  return {
    source: "provider_verified",
    provider: "google",
    providerPlaceId: selection.placeId,
    label: selection.label,
    longitude: String(selection.longitude),
    latitude: String(selection.latitude),
    countryCode: selection.countryCode,
    snapshot: selection.snapshot,
    attribution: null,
  };
}
