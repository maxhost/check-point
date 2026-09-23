import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import CatalogPage from "./catalog-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("catalog")) redirect("/backoffice");
  return <CatalogPage canDelete={session.membership.role === "owner"} />;
}
