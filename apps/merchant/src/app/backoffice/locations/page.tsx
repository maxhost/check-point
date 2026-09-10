import { eq } from "drizzle-orm";
import { requireOwner } from "../../../server/auth-guards";
import { getDb } from "../../../server/db";
import { businesses, subscriptions } from "../../../server/schema";
import { listLocations, locationLimitForPlan } from "../../../server/locations";
import { LocationsConsole } from "./locations-console";

export const dynamic = "force-dynamic";

/** Owner-only (decision 4 of spec 0061); `requireOwner` sends staff to the counter. */
export default async function LocationsPage() {
  const { business } = await requireOwner();

  const [row] = await getDb()
    .select({
      countryCode: businesses.countryCode,
      plan: subscriptions.plan,
    })
    .from(businesses)
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(eq(businesses.id, business.id))
    .limit(1);

  return (
    <LocationsConsole
      initialLocations={await listLocations(business.id)}
      countryCode={row?.countryCode ?? "EC"}
      // Advisory only: it decides whether the "add" button is rendered. The cap that
      // holds is `createLocation`'s, under the business row lock.
      activeLimit={locationLimitForPlan(row?.plan)}
    />
  );
}
