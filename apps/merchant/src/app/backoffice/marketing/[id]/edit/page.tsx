import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireOwner } from "../../../../../server/auth-guards";
import { getDb } from "../../../../../server/db";
import { listLocations } from "../../../../../server/locations";
import { products } from "../../../../../server/schema";
import { previewAudience } from "../../../../../server/marketing/audience-preview";
import { countActiveTurns } from "../../../../../server/marketing/campaign-list";
import { remainingQuota } from "../../../../../server/marketing/composer-summary";
import { isEditable } from "../../../../../server/marketing/campaign-transitions";
import { CampaignComposer } from "../../composer";
import { loadOwnCampaign } from "../page";

export const dynamic = "force-dynamic";

/**
 * Editing reuses the composer instead of growing a second form: the five blocks, the
 * validation messages and the live counts are the same, and a copy would drift on the
 * first change.
 *
 * A campaign that is NOT `draft`/`paused` is a 404 here and not a disabled form. The
 * `PATCH` answers 409 `not_editable` anyway — that is the guard that holds — but a screen
 * that renders inputs the server will refuse is a screen that lies about what it can do.
 * The rule comes from `isEditable`, the same one `updateCampaign` reads.
 */
export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { business } = await requireOwner();
  const { id } = await params;
  const campaign = await loadOwnCampaign(business.id, id);
  if (!isEditable(campaign.status)) notFound();
  const [locations, catalog, activeTurns] = await Promise.all([
    listLocations(business.id),
    getDb()
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.businessId, business.id))
      .orderBy(asc(products.name)),
    countActiveTurns(business.id),
  ]);
  const active = locations.filter((location) => location.status === "active");
  return (
    <CampaignComposer
      campaign={campaign}
      locations={active}
      products={catalog}
      remainingQuota={remainingQuota(activeTurns)}
      currencyCode={business.currencyCode}
      initialPreview={await previewAudience(business.id, {
        dormantDays: campaign.dormantDays,
        locationIds: campaign.locationIds,
      })}
    />
  );
}
