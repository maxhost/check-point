import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { BusinessConsole } from "./business-console";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const session = await requireBackofficeSession();
  if (
    session.membership.role !== "owner" &&
    !session.membership.permissions.includes("business")
  )
    redirect("/backoffice");
  return <BusinessConsole />;
}
