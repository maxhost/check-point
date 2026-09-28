import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../../server/auth-guards";
import { CampaignPage } from "../campaign-page";

export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("marketing"))
    redirect("/backoffice");
  const { id } = await params;
  return (
    <CampaignPage
      id={id}
      isOwner={session.membership.role === "owner"}
      canReadLocations={session.membership.permissions.includes("locations")}
      currencyCode={session.business.currencyCode}
    />
  );
}
