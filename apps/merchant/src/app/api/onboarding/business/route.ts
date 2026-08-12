import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import {
  businesses,
  locations,
  memberships,
  ownerProfiles,
  subscriptions,
} from "../../../../server/schema";

type CreateBusinessInput = {
  name?: unknown;
  locationName?: unknown;
  address?: {
    label?: unknown;
    longitude?: unknown;
    latitude?: unknown;
    featureId?: unknown;
    snapshot?: unknown;
  };
};

type MapboxFeature = {
  geometry?: { coordinates?: unknown[] };
  properties?: {
    full_address?: unknown;
    place_formatted?: unknown;
    mapbox_id?: unknown;
    [key: string]: unknown;
  };
};

const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const coordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : null;

async function verifyPermanentMapboxAddress(
  address: NonNullable<CreateBusinessInput["address"]>,
) {
  const token = process.env.MAPBOX_SERVER_ACCESS_TOKEN;
  const featureId = nonEmpty(address.featureId);
  if (!token || !featureId) {
    throw new Error("La validación permanente de Mapbox no está configurada.");
  }
  const params = new URLSearchParams({
    q: featureId,
    access_token: token,
    permanent: "true",
    country: "EC,AR,CL,PY,UY,PE,CO,MX,BR",
    limit: "1",
  });
  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
  );
  const body = (await response.json()) as { features?: MapboxFeature[] };
  const feature = body.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  const longitude = coordinate(coordinates?.[0]);
  const latitude = coordinate(coordinates?.[1]);
  const label =
    nonEmpty(feature?.properties?.full_address) ??
    nonEmpty(feature?.properties?.place_formatted);
  if (!response.ok || !feature || !longitude || !latitude || !label) {
    throw new Error("No pudimos verificar esa dirección con Mapbox.");
  }
  return {
    label,
    longitude,
    latitude,
    featureId: nonEmpty(feature.properties?.mapbox_id) ?? featureId,
    snapshot: feature.properties ?? {},
  };
}

export async function POST(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = (await request.json()) as CreateBusinessInput;
  const name = nonEmpty(body.name);
  const locationName = nonEmpty(body.locationName);
  if (
    !name ||
    !locationName ||
    !body.address ||
    !nonEmpty(body.address.featureId)
  ) {
    return NextResponse.json(
      { error: "Selecciona una dirección válida de Mapbox." },
      { status: 400 },
    );
  }
  let address;
  try {
    address = await verifyPermanentMapboxAddress(body.address);
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
    db.insert(businesses).values({ id: businessId, name }),
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
      mapboxFeatureId: address.featureId,
      addressSnapshot: address.snapshot,
    }),
    db.insert(subscriptions).values({
      businessId,
      plan: "free",
      status: "active",
    }),
  ]);
  return NextResponse.json({ businessId }, { status: 201 });
}
