import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import {
  businesses,
  locations,
  locationVerifications,
  memberships,
  ownerProfiles,
  subscriptions,
} from "../../../../server/schema";
import {
  isSupportedCountryCode,
  verifyLocation,
} from "../../../../server/location-providers";
import { isIanaTimezone } from "../../../../server/timezone";
import {
  isUniqueViolation,
  slugForNewBusiness,
} from "../../../../server/business-slug";
import { currencyForCountry } from "../../../../lib/currencies";

type CreateBusinessInput = {
  name?: unknown;
  countryCode?: unknown;
  timezone?: unknown;
  locationName?: unknown;
  address?: {
    label?: unknown;
    provider?: unknown;
    longitude?: unknown;
    latitude?: unknown;
    featureId?: unknown;
    snapshot?: unknown;
  };
};

const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const coordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : null;

export async function POST(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = (await request.json()) as CreateBusinessInput;
  const name = nonEmpty(body.name);
  const countryCode = nonEmpty(body.countryCode)?.toUpperCase();
  const timezone = nonEmpty(body.timezone);
  const locationName = nonEmpty(body.locationName);
  if (
    !name ||
    !countryCode ||
    !isSupportedCountryCode(countryCode) ||
    !timezone ||
    !isIanaTimezone(timezone) ||
    !locationName ||
    !body.address ||
    !coordinate(body.address.longitude) ||
    !coordinate(body.address.latitude)
  ) {
    return NextResponse.json(
      { error: "Selecciona una ubicación válida." },
      { status: 400 },
    );
  }
  let address;
  try {
    address = await verifyLocation(body.address, countryCode);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos validar la dirección.",
      },
      { status: 503 },
    );
  }

  const businessId = randomUUID();
  const locationId = randomUUID();
  const verificationId = randomUUID();
  try {
    const db = getDb();
    const [existingMembership] = await db
      .select({ businessId: memberships.businessId })
      .from(memberships)
      .where(eq(memberships.userId, session.user.id))
      .limit(1);
    if (existingMembership) {
      return NextResponse.json(
        { error: "Tu negocio inicial ya fue creado." },
        { status: 409 },
      );
    }
    // EL SLUG SE GENERA Y SE PERSISTE ACÁ (spec 0067 §1). Pasa por `slugForNewBusiness`,
    // no por `slugify` a secas: la derivación puede caer en una palabra RESERVADA
    // (`"Admin"` → `"admin"`) o colapsar a `"000"` todo nombre sin caracteres latinos, y
    // en los dos casos el comercio se llevaría puesto un identificador que no debería
    // tener. La unicidad la decide `core_business_slug_unique`, no esta lectura.
    const slug = await slugForNewBusiness(name);
    await db.batch([
      db
        .insert(ownerProfiles)
        .values({
          userId: session.user.id,
          fullName: session.user.name,
        })
        .onConflictDoNothing(),
      db.insert(businesses).values({
        id: businessId,
        name,
        slug,
        countryCode,
        timezone,
        currencyCode: currencyForCountry(countryCode),
      }),
      db.insert(memberships).values({
        businessId,
        userId: session.user.id,
        role: "owner",
      }),
      db.insert(locations).values({
        id: locationId,
        businessId,
        name: locationName,
        addressLabel: address.label,
        longitude: address.longitude,
        latitude: address.latitude,
        countryCode: address.countryCode,
        activeVerificationId: verificationId,
        addressSnapshot: address.snapshot,
      }),
      db.insert(locationVerifications).values({
        id: verificationId,
        locationId,
        source: address.source,
        provider: address.provider,
        providerPlaceId: address.providerPlaceId,
        normalizedAddress: address.label,
        longitude: address.longitude,
        latitude: address.latitude,
        countryCode: address.countryCode,
        providerSnapshot: address.snapshot,
        attribution: address.attribution,
      }),
      db.insert(subscriptions).values({
        businessId,
        plan: "free",
        status: "active",
      }),
    ]);
    return NextResponse.json({ businessId, slug }, { status: 201 });
  } catch (error) {
    // El TOCTOU del slug: entre leer los tomados y escribir cabe otra alta con el mismo
    // nombre. El comerciante no eligió este valor —el wizard no muestra el campo—, así que
    // devolverle un 409 con una sugerencia no tendría a quién ofrecérsela: el 503 le dice
    // que reintente y el reintento deriva el siguiente libre.
    console.error("onboarding_business_failed", {
      name: error instanceof Error ? error.name : typeof error,
      slugConflict: isUniqueViolation(error),
    });
    return NextResponse.json(
      { error: "No pudimos guardar tu negocio. Intenta nuevamente." },
      { status: 503 },
    );
  }
}
