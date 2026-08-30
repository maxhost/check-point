import { asc, eq } from "drizzle-orm";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { getDb } from "../../../server/db";
import { locations } from "../../../server/schema";
import { listTodaysAccreditations } from "../../../server/counter";
import { CounterConsole } from "./counter-console";

export const dynamic = "force-dynamic";

export default async function CounterPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  // Owner or active staff may operate the counter (ADR 0044).
  const { business, userName } = await requireBackofficeSession();

  const locationList = await getDb()
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.businessId, business.id))
    .orderBy(asc(locations.name));

  const history = await listTodaysAccreditations(
    business.id,
    business.timezone,
    new Date(),
  );

  const { location } = await searchParams;

  return (
    <CounterConsole
      currencyCode={business.currencyCode}
      operatorName={userName}
      history={history}
      locations={locationList}
      preselectedLocationId={location}
    />
  );
}
