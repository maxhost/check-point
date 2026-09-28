import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../../server/auth-guards";
import { MarketingSettingsPage } from "../settings-page";

export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("marketing"))
    redirect("/backoffice");
  return (
    <MarketingSettingsPage isOwner={session.membership.role === "owner"} />
  );
}
