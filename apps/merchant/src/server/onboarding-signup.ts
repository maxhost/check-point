import { randomUUID } from "node:crypto";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  locationVerifications,
  memberships,
  ownerProfiles,
  subscriptions,
} from "@mi-pasaporte/db/schema";
import { currencyForCountry } from "@mi-pasaporte/domain/lib/currencies";
import { isBusinessCategory } from "../lib/business-categories";
import { ownerUserInsert } from "./auth-start";
import { slugForNewBusiness } from "./business-slug";
import type { Selection } from "./places/selection-token";

/**
 * Spec 0155 / ADR 0121 §12 — LA CUENTA Y EL NEGOCIO NACEN EN UNA ESCRITURA.
 *
 * `POST /api/onboarding/signup` reemplaza a `auth/start` (cuenta) + `onboarding/business`
 * (negocio). Aca vive lo que no es HTTP: validar el negocio del cuerpo y el `db.batch` que
 * crea todo. Con neon-http `db.batch` es UNA transaccion: no queda cuenta sin negocio ni
 * negocio sin dueño si algo falla a mitad (limite declarado: no hay test que fuerce ese
 * fallo).
 */
export class SignupBusinessError extends Error {
  constructor(
    readonly field: "name" | "categoryGcid",
    message: string,
  ) {
    super(message);
    this.name = "SignupBusinessError";
  }
}

export const MAX_BUSINESS_NAME = 120;
/** El local que nace con el negocio. */
export const FIRST_LOCATION_NAME = "Principal";

export type SignupBusiness = {
  name: string;
  categoryGcid: string;
  selectionToken: unknown;
};

/** `name` (trim, 1–120) y `categoryGcid` de la lista curada → `400 invalid_business`. */
export function parseSignupBusiness(value: unknown): SignupBusiness {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length > MAX_BUSINESS_NAME)
    throw new SignupBusinessError(
      "name",
      `El nombre del negocio es obligatorio (hasta ${MAX_BUSINESS_NAME} caracteres).`,
    );
  // Spec 0069 §D1: la categoria es OBLIGATORIA en el alta y viene de la lista curada. El
  // DEFAULT `'gcid:store'` de la columna es relleno de migracion y NO se puede pedir.
  if (!isBusinessCategory(raw.categoryGcid))
    throw new SignupBusinessError(
      "categoryGcid",
      "Selecciona una categoría válida.",
    );
  return {
    name,
    categoryGcid: raw.categoryGcid,
    selectionToken: raw.selectionToken,
  };
}

export type CreatedOwner = {
  userId: string;
  businessId: string;
  slug: string;
};

/**
 * Crea `user` + `owner_profile` + `business` + membresia owner + local «Principal» con su
 * verificacion `provider_verified`/`google` + suscripcion free, en UN `db.batch`.
 *
 * El slug pasa por `slugForNewBusiness` (nunca una reservada ni un `000` repetido); su
 * unicidad la decide `core_business_slug_unique` y el choque sale como unique violation,
 * igual que el del email: el llamador los distingue.
 */
export async function createOwnerWithBusiness(input: {
  email: string;
  business: { name: string; categoryGcid: string };
  selection: Selection;
}): Promise<CreatedOwner> {
  const db = getDb();
  const { selection } = input;
  const businessId = randomUUID();
  const locationId = randomUUID();
  const verificationId = randomUUID();
  const latitude = String(selection.latitude);
  const longitude = String(selection.longitude);
  const slug = await slugForNewBusiness(input.business.name);
  const owner = ownerUserInsert(db, input.email);
  await db.batch([
    owner.query,
    db.insert(ownerProfiles).values({ userId: owner.userId, fullName: "" }),
    db.insert(businesses).values({
      id: businessId,
      name: input.business.name,
      slug,
      categoryGcid: input.business.categoryGcid,
      countryCode: selection.countryCode,
      timezone: selection.timezone,
      currencyCode: currencyForCountry(selection.countryCode),
    }),
    db.insert(memberships).values({
      businessId,
      userId: owner.userId,
      role: "owner",
    }),
    db.insert(locations).values({
      id: locationId,
      businessId,
      name: FIRST_LOCATION_NAME,
      addressLabel: selection.label,
      longitude,
      latitude,
      countryCode: selection.countryCode,
      activeVerificationId: verificationId,
      addressSnapshot: selection.snapshot,
    }),
    db.insert(locationVerifications).values({
      id: verificationId,
      locationId,
      source: "provider_verified",
      provider: "google",
      providerPlaceId: selection.placeId,
      normalizedAddress: selection.label,
      longitude,
      latitude,
      countryCode: selection.countryCode,
      providerSnapshot: selection.snapshot,
      attribution: null,
    }),
    db.insert(subscriptions).values({
      businessId,
      plan: "free",
      status: "active",
    }),
  ]);
  return { userId: owner.userId, businessId, slug };
}
