import { asc, eq } from "drizzle-orm";
import { requireOwner } from "../../../../server/auth-guards";
import { getDb } from "../../../../server/db";
import { listLocations } from "../../../../server/locations";
import { products } from "../../../../server/schema";
import { previewAudience } from "../../../../server/marketing/audience-preview";
import { countActiveTurns } from "../../../../server/marketing/campaign-list";
import { remainingQuota } from "../../../../server/marketing/composer-summary";
import { DEFAULT_DORMANT_DAYS } from "../composer-draft";
import { CampaignComposer } from "../composer";

export const dynamic = "force-dynamic";

/**
 * The composer's page. It resolves server-side everything the first paint needs — the
 * active doors, the catalog names for the optional coupon product, the business's live
 * share of the quota and the counts of the DEFAULT audience — so block 1 and block 5
 * open with real numbers instead of «calculando».
 *
 * Only `id` and `name` are read from `core.product` on purpose: a product row carries
 * `*ObjectKey`s of R2, and a page that handed the whole DTO to a client component would
 * serialize them into the payload. `CLAUDE.md` names this leak by name — it was already
 * caught once in marca (spec 0025).
 */
export default async function NewCampaignPage() {
  const { business } = await requireOwner();
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
      locations={active}
      products={catalog}
      remainingQuota={remainingQuota(activeTurns)}
      currencyCode={business.currencyCode}
      initialPreview={await previewAudience(business.id, {
        dormantDays: DEFAULT_DORMANT_DAYS,
        locationIds: active.map((location) => location.id),
      })}
    />
  );
}
