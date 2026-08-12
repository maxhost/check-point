import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMerchantAuth } from "../server/auth";

export const dynamic = "force-dynamic";

export default async function MerchantEntryPage() {
  const session = await getMerchantAuth().api.getSession({
    headers: await headers(),
  });
  redirect(session ? "/backoffice" : "/onboarding");
}
