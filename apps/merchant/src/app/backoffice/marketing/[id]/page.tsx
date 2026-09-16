import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireOwner } from "../../../../server/auth-guards";
import { getDb } from "../../../../server/db";
import { locations } from "../../../../server/schema";
import {
  CampaignError,
  getCampaign,
  type Campaign,
} from "../../../../server/marketing/campaign-store";
import { loadCampaignResults } from "../../../../server/marketing/results-store";
import { CampaignDetail } from "./campaign-detail";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a campaign of THIS business or answers 404 — the page half of the spec's
 * isolation item. Two things it is deliberately not:
 *
 *  - not a 403, ever. A 403 tells the caller the id exists, which is the enumeration the
 *    isolation item forbids; `getCampaign` already scopes by `business_id` and raises
 *    `not_found` for someone else's campaign.
 *  - not a bare call. A malformed `[id]` never reaches Postgres: without the shape check
 *    the driver raises `22P02 invalid input syntax for type uuid` and the owner gets a
 *    500 where the honest answer is «no existe».
 */
export async function loadOwnCampaign(
  businessId: string,
  id: string,
): Promise<Campaign> {
  if (!UUID.test(id)) notFound();
  try {
    return await getCampaign(businessId, id);
  } catch (error) {
    if (error instanceof CampaignError && error.status === 404) notFound();
    throw error;
  }
}

/** Door names for the definition block. Read here and not inside the campaign DTO: the
 * store returns `locationIds` because that is what the composer round-trips, and a name
 * is a presentation concern of this screen. */
export async function locationNamesOf(
  businessId: string,
): Promise<Record<string, string>> {
  const rows = await getDb()
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.businessId, businessId));
  return Object.fromEntries(rows.map((row) => [row.id, row.name]));
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { business } = await requireOwner();
  const { id } = await params;
  const campaign = await loadOwnCampaign(business.id, id);
  const [results, locationNames] = await Promise.all([
    loadCampaignResults(business.id, campaign.id, {
      label: campaign.couponLabel,
      cap: campaign.couponMaxRedemptions,
    }),
    locationNamesOf(business.id),
  ]);
  return (
    <CampaignDetail
      campaign={campaign}
      results={results}
      locationNames={locationNames}
      currencyCode={business.currencyCode}
    />
  );
}
