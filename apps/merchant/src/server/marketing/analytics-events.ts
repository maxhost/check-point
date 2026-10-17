import { randomUUID } from "node:crypto";
import type { DbTransaction } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import type { CampaignSnapshot } from "@mi-pasaporte/domain/analytics/metrics";
import { appendModuleEvent } from "../module-events/append";
/** Producer-owned snapshot. Analytics never reads marketing tables. */
export async function publishCampaignSnapshot(
  tx: DbTransaction,
  businessId: string,
  campaignId: string,
) {
  const [row] = await tx
    .select()
    .from(campaigns)
    .where(
      and(eq(campaigns.businessId, businessId), eq(campaigns.id, campaignId)),
    );
  if (!row) throw new Error("Campaign snapshot origin unavailable");
  const payload: CampaignSnapshot & { eventVersion: 1 } = {
    eventVersion: 1,
    campaignId: row.id,
    label: row.name,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    capturedAt: new Date().toISOString(),
  };
  await appendModuleEvent(tx, {
    businessId,
    eventType: "campaign.snapshot",
    eventVersion: 1,
    sourceId: randomUUID(),
    locationId: null,
    payload,
  });
}
