import { and, desc, eq, inArray } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "../db";
import { campaignLocations, campaigns, locations } from "../schema";
import {
  type CampaignInput,
  parseCampaignInput,
  parseCampaignPatch,
} from "./campaign-input";
import { type CampaignStatus, isEditable } from "./campaign-transitions";

/**
 * Every read and write of `core.campaign` the backoffice does (spec 0065 phase B). Two
 * rules hold across the whole file and are not repeated in each function:
 *
 *  1. **Everything is scoped by `business_id`, and a campaign of another business is a
 *     404, never a 403.** A 403 tells the caller the id EXISTS, which is the enumeration
 *     the spec's isolation item forbids.
 *  2. **No route cancels turns.** Pausing or ending a campaign only moves its `status`;
 *     step 3 of the tick is what writes each live turn's `cancel_reason` on the next run.
 *     The routes say so in their answer, because an owner who reads «pausada» and still
 *     sees the door on their own pass would reasonably think it failed.
 */

export class CampaignError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  pauseReason: string | null;
  dormantDays: number;
  message: string;
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  activatedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  locationIds: string[];
};

const columns = {
  id: campaigns.id,
  name: campaigns.name,
  status: campaigns.status,
  pauseReason: campaigns.pauseReason,
  dormantDays: campaigns.dormantDays,
  message: campaigns.message,
  couponLabel: campaigns.couponLabel,
  couponCost: campaigns.couponCost,
  couponMaxRedemptions: campaigns.couponMaxRedemptions,
  couponProductId: campaigns.couponProductId,
  startsAt: campaigns.startsAt,
  endsAt: campaigns.endsAt,
  activatedAt: campaigns.activatedAt,
  endedAt: campaigns.endedAt,
  createdAt: campaigns.createdAt,
};

function notFound(): CampaignError {
  return new CampaignError(404, "not_found", "No encontramos esa campaña.");
}

async function doorsOf(
  db: DbTransaction | ReturnType<typeof getDb>,
  campaignId: string,
): Promise<string[]> {
  const rows = await db
    .select({ locationId: campaignLocations.locationId })
    .from(campaignLocations)
    .where(eq(campaignLocations.campaignId, campaignId));
  return rows.map((row) => row.locationId);
}

/**
 * The doors the owner chose, filtered to the ones that BELONG to this business. Without
 * the filter the composer could attach another business's location by id — the campaign
 * would then place turns at a door its owner never agreed to.
 */
async function ownDoors(
  tx: DbTransaction,
  businessId: string,
  locationIds: string[],
): Promise<string[]> {
  const rows = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        inArray(locations.id, locationIds),
      ),
    );
  if (rows.length !== locationIds.length)
    throw new CampaignError(400, "validation", "Revisá los locales elegidos.", {
      locationIds: "Hay un local que no es tuyo o no existe.",
    });
  return rows.map((row) => row.id);
}

async function writeDoors(
  tx: DbTransaction,
  campaignId: string,
  locationIds: string[],
): Promise<void> {
  await tx
    .delete(campaignLocations)
    .where(eq(campaignLocations.campaignId, campaignId));
  await tx
    .insert(campaignLocations)
    .values(locationIds.map((locationId) => ({ campaignId, locationId })));
}

export async function listCampaigns(businessId: string): Promise<Campaign[]> {
  const rows = await getDb()
    .select(columns)
    .from(campaigns)
    .where(eq(campaigns.businessId, businessId))
    .orderBy(desc(campaigns.createdAt));
  const db = getDb();
  return await Promise.all(
    rows.map(async (row) => ({
      ...(row as Omit<Campaign, "locationIds">),
      locationIds: await doorsOf(db, row.id),
    })),
  );
}

export async function getCampaign(
  businessId: string,
  id: string,
): Promise<Campaign> {
  const [row] = await getDb()
    .select(columns)
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.businessId, businessId)))
    .limit(1);
  if (!row) throw notFound();
  return {
    ...(row as Omit<Campaign, "locationIds">),
    locationIds: await doorsOf(getDb(), id),
  };
}

export async function createCampaign(
  businessId: string,
  userId: string,
  body: unknown,
): Promise<Campaign> {
  const parsed = parseCampaignInput(body);
  if (!parsed.ok)
    throw new CampaignError(
      400,
      "validation",
      "Revisá los datos de la campaña.",
      parsed.errors,
    );
  const input = parsed.value;
  const id = await withDbTransaction(async (tx) => {
    const doors = await ownDoors(tx, businessId, input.locationIds);
    const [created] = await tx
      .insert(campaigns)
      .values({
        businessId,
        kind: "proximity",
        createdByUserId: userId,
        name: input.name,
        message: input.message,
        dormantDays: input.dormantDays,
        couponLabel: input.couponLabel,
        couponCost: input.couponCost,
        couponMaxRedemptions: input.couponMaxRedemptions,
        couponProductId: input.couponProductId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      })
      .returning({ id: campaigns.id });
    await writeDoors(tx, created.id, doors);
    return created.id;
  });
  return await getCampaign(businessId, id);
}

export async function updateCampaign(
  businessId: string,
  id: string,
  body: unknown,
): Promise<Campaign> {
  const current = await getCampaign(businessId, id);
  if (!isEditable(current.status))
    throw new CampaignError(
      409,
      "not_editable",
      "Solo se puede editar una campaña en borrador o pausada.",
    );
  const parsed = parseCampaignPatch(
    body,
    current as CampaignInput & {
      status: CampaignStatus;
    },
  );
  if (!parsed.ok)
    throw new CampaignError(
      400,
      "validation",
      "Revisá los datos de la campaña.",
      parsed.errors,
    );
  const input = parsed.value;
  await withDbTransaction(async (tx) => {
    const doors = await ownDoors(tx, businessId, input.locationIds);
    await tx
      .update(campaigns)
      .set({
        name: input.name,
        message: input.message,
        dormantDays: input.dormantDays,
        couponLabel: input.couponLabel,
        couponCost: input.couponCost,
        couponMaxRedemptions: input.couponMaxRedemptions,
        couponProductId: input.couponProductId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.id, id), eq(campaigns.businessId, businessId)));
    await writeDoors(tx, id, doors);
  });
  return await getCampaign(businessId, id);
}
