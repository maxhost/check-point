import { and, asc, eq } from "drizzle-orm";
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

  // Only ACTIVE locations are offered (spec 0061). This is the interface half of the
  // guard; the half that decides is `assertLocationInBusiness`, which rejects an archived
  // `locationId` even when it arrives through `?location=` or a stale tab.
  const locationList = await getDb()
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, business.id),
        eq(locations.status, "active"),
      ),
    )
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
