import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { getDb } from "@mi-pasaporte/db";
import { locations } from "@mi-pasaporte/db/schema";
import {
  destinationWithLocation,
  readBackofficeDestination,
} from "../../../server/backoffice-destination";

export const dynamic = "force-dynamic";

export default async function CounterPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const session = await requireBackofficeSession();
  const destination = (await readBackofficeDestination(session)) ?? notFound();
  const { location } = await searchParams;
  const active = location
    ? await getDb()
        .select({ id: locations.id })
        .from(locations)
        .where(
          and(
            eq(locations.businessId, session.business.id),
            eq(locations.status, "active"),
          ),
        )
    : [];
  redirect(
    destinationWithLocation(
      destination,
      location,
      active.map(({ id }) => id),
    ),
  );
}
