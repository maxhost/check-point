import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { locations } from "@mi-pasaporte/db/schema";
import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { PosConsole } from "./pos-console";
export const dynamic = "force-dynamic";
export default async function PosPage() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("pos")) redirect("/backoffice");
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
  return <PosConsole locations={locationList} />;
}
