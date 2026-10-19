import { Suspense } from "react";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { locations } from "@mi-pasaporte/db/schema";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { PosEntry } from "./pos-entry";
export async function PosScreen() {
  const session = await requireBackofficeSession();
  const locationList = await getDb()
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, session.business.id),
        eq(locations.status, "active"),
      ),
    )
    .orderBy(asc(locations.name));
  return (
    <Suspense>
      <PosEntry
        locations={locationList}
        previewEnabled={process.env.NODE_ENV === "development"}
      />
    </Suspense>
  );
}
