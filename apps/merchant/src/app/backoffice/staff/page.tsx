import { requireBackofficeSession } from "../../../server/auth-guards";
import { redirect } from "next/navigation";
import { StaffConsole } from "./staff-console";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("staff"))
    redirect("/backoffice");
  return <StaffConsole />;
}
