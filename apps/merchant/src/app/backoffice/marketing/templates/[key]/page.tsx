import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../../../server/auth-guards";
import { TemplateEditor } from "../../template-editor";

export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("marketing"))
    redirect("/backoffice");
  const { key } = await params;
  return (
    <TemplateEditor
      templateKey={key}
      isOwner={session.membership.role === "owner"}
      canReadLocations={session.membership.permissions.includes("locations")}
      canReadCatalog={session.membership.permissions.includes("catalog")}
    />
  );
}
