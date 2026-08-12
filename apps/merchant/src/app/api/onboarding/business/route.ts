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
  const locationName = nonEmpty(body.locationName);
  const label = nonEmpty(body.address?.label);
  const longitude = coordinate(body.address?.longitude);
  const latitude = coordinate(body.address?.latitude);
  if (!name || !locationName || !label || !longitude || !latitude) {
    return NextResponse.json(
      { error: "Selecciona una dirección válida de Mapbox." },
      { status: 400 },
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
      addressLabel: label,
      longitude,
      latitude,
      mapboxFeatureId: nonEmpty(body.address?.featureId),
      addressSnapshot: body.address?.snapshot ?? {},
    }),
    db.insert(subscriptions).values({
      businessId,
      plan: "free",
      status: "active",
    }),
  ]);
  return NextResponse.json({ businessId }, { status: 201 });
}
