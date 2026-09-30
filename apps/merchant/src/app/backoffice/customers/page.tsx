import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { getDb } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import { CustomersPage } from "./customers-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("counter"))
    redirect("/backoffice");

  const [business] = await getDb()
    .select({ countryCode: businesses.countryCode })
    .from(businesses)
    .where(eq(businesses.id, session.business.id))
    .limit(1);

  return <CustomersPage defaultCountryIso={business?.countryCode ?? "EC"} />;
}
