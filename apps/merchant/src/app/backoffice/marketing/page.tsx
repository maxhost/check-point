import { requireOwner } from "../../../server/auth-guards";
import { listCampaignOverviews } from "../../../server/marketing/campaign-list";
import { CampaignsList } from "./campaigns-list";

export const dynamic = "force-dynamic";

/** Owner-only, like every other backoffice section: `requireOwner` sends staff to the
 * counter. It is a PAGE guard and answers with `redirect()` — the API routes use
 * `requireMarketingOwner` instead, which answers 403, and confusing the two is what the
 * adversarial review of spec 0065 caught before any code existed. */
export default async function MarketingPage() {
  const { business } = await requireOwner();
  return <CampaignsList overviews={await listCampaignOverviews(business.id)} />;
}
