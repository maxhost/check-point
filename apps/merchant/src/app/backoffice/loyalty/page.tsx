import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import LoyaltyProgramPage from "./loyalty-page";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("loyalty"))
    redirect("/backoffice");
  return (
    <LoyaltyProgramPage
      isOwner={session.membership.role === "owner"}
      canReadCatalog={session.membership.permissions.includes("catalog")}
    />
  );
}
