import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { RecipesConsole } from "./recipes-console";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("catalog"))
    redirect("/backoffice");
  return <RecipesConsole />;
}
