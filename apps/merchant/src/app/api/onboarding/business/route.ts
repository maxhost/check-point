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

type CreateBusinessInput = {
  name?: unknown;
  countryCode?: unknown;
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
  const locationName = nonEmpty(body.locationName);
  if (
    !name ||
    !countryCode ||
    !isSupportedCountryCode(countryCode) ||
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
    await db.batch([
      db
        .insert(ownerProfiles)
        .values({
          userId: session.user.id,
          fullName: session.user.name,
        })
        .onConflictDoNothing(),
      db.insert(businesses).values({ id: businessId, name, countryCode }),
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
    return NextResponse.json({ businessId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No pudimos guardar tu negocio. Intenta nuevamente." },
      { status: 503 },
    );
  }
}
