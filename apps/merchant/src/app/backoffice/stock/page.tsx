import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { StockLog } from "./stock-log";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("catalog"))
    redirect("/backoffice");
  return <StockLog />;
}
