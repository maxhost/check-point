import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import BrandPage from "./brand-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("brand"))
    redirect("/backoffice");
  return <BrandPage isOwner={session.membership.role === "owner"} />;
}
