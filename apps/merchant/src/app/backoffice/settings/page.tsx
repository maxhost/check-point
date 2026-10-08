import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { PosSettings } from "./pos-settings";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const session = await requireBackofficeSession();
  if (session.membership.role !== "owner") redirect("/backoffice");
  return <PosSettings />;
}
