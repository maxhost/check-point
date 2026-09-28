import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../../../server/auth-guards";
import { CampaignComposer } from "../../composer";

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
    <CampaignComposer
      campaignId={id}
      currencyCode={session.business.currencyCode}
      isOwner={session.membership.role === "owner"}
      canReadLocations={session.membership.permissions.includes("locations")}
      canReadCatalog={session.membership.permissions.includes("catalog")}
    />
  );
}
