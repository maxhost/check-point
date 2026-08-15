import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../server/auth";
import { getDb } from "../../../server/db";
import { businesses, locations, memberships } from "../../../server/schema";
import { CounterConsole } from "./counter-console";

export const dynamic = "force-dynamic";

export default async function CounterPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const session = await getMerchantAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const [business] = await getDb()
    .select({ id: businesses.id, currencyCode: businesses.currencyCode })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  if (!business) redirect("/onboarding");

  const locationList = await getDb()
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.businessId, business.id))
    .orderBy(asc(locations.name));

  const { location } = await searchParams;

  return (
    <CounterConsole
      currencyCode={business.currencyCode}
      locations={locationList}
      preselectedLocationId={location}
    />
  );
}
