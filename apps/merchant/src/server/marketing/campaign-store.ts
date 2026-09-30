import { and, desc, eq, inArray } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  campaignLocations,
  campaigns,
  locations,
} from "@mi-pasaporte/db/schema";
import {
  type CampaignInput,
  parseCampaignInput,
  parseCampaignPatch,
} from "./campaign-input";
import { type CampaignStatus, isEditable } from "./campaign-transitions";
import { PLAN_NOT_ALLOWED_MESSAGE, planAllowsCampaigns } from "./plan-gate";
import type { CampaignWelcome } from "./campaign-values";
import type { CampaignCross } from "./cross-store";
import type { CampaignValley } from "./valley-store";
import { columns, toCampaign } from "./campaign-row";
import { CampaignError } from "./campaign-error";
import { type CouponKind, type DiscountUnit, pickReward } from "./reward-input";
import { assertExtrasFitProgram, assertOwnProduct } from "./reward-store";

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

export { CampaignError };

export type Campaign = {
  id: string;
  /**
   * Spec 0101: the prebuilt template it runs, or `null` for a custom campaign. Every read
   * of this file ALWAYS sets it (`columns`, `campaign-row.ts`), so the type REQUIRES it: a fixture that
   * builds a `Campaign` by hand has to say `templateKey: null` explicitly.
   */
  templateKey: string | null;
  /** Spec 0103: `proximity`, `push` or both, in that order. */
  channels: ("proximity" | "push")[];
  name: string;
  status: CampaignStatus;
  pauseReason: string | null;
  dormantDays: number;
  message: string;
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
  /**
   * Spec 0106: the reward's type and fields. Every read of this file ALWAYS sets them
   * (`rewardSelect`); they are OPTIONAL in the type only so the backoffice fixtures that
   * build a `Campaign` by hand (being rewritten outside this spec) keep compiling.
   */
  couponKind?: CouponKind | null;
  couponDiscountUnit?: DiscountUnit | null;
  couponDiscountValue?: string | null;
  couponExtraUnits?: number | null;
  couponRule?: string | null;
  /** Spec 0104: #7's thresholds and #8's repetition; `null` in any other campaign. */
  nearRewardStamps: number | null;
  nearRewardPercent: number | null;
  rewardRepeat: "once" | "every_30_days" | null;
  /** Spec 0107: «Bienvenida»'s parameters. Always set by the reads; optional for fixtures. */
  welcome?: CampaignWelcome | null;
  /** Spec 0112: «Oferta cruzada»'s parameters. Always set by the reads; optional for fixtures. */
  cross?: CampaignCross | null;
  /** Spec 0113: «Horas valle»'s cap. Always set by the reads; optional for fixtures. */
  valley?: CampaignValley | null;
  startsAt: Date;
  endsAt: Date | null;
  activatedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  locationIds: string[];
};

/** The columns the composer writes: its fields and the whole reward (spec 0106). */
function campaignFields(input: CampaignInput) {
  const { name, message, dormantDays, startsAt, endsAt } = input;
  return { name, message, dormantDays, startsAt, endsAt, ...pickReward(input) };
}

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
    rows.map(async (row) => toCampaign(row, await doorsOf(db, row.id))),
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
  return toCampaign(row, await doorsOf(getDb(), id));
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
    // EL GATE DE PLAN TAMBIÉN EN CREAR (spec 0065, fase D): «un `free` no compone
    // campañas». Va DENTRO de la transacción y antes de cualquier escritura, con el mismo
    // `plan-gate` que usa `activate`: dos reglas separadas divergirían el día que el plan
    // de pago cambie de nombre.
    if (!(await planAllowsCampaigns(tx, businessId)))
      throw new CampaignError(
        402,
        "plan_not_allowed",
        PLAN_NOT_ALLOWED_MESSAGE,
      );
    const doors = await ownDoors(tx, businessId, input.locationIds);
    await assertOwnProduct(tx, businessId, input.couponProductId);
    await assertExtrasFitProgram(tx, businessId, input.couponKind);
    const [created] = await tx
      .insert(campaigns)
      .values({
        ...campaignFields(input),
        businessId,
        kind: "proximity",
        createdByUserId: userId,
      })
      .returning({ id: campaigns.id });
    await writeDoors(tx, created.id, doors);
    return created.id;
  });
  return await getCampaign(businessId, id);
}

/**
 * Spec 0101 / ADR 0092 §3 — A PREBUILT CAMPAIGN IS NEVER EDITED, in ANY status (a paused
 * one included): «si cambia parametros las estadisticas se vuelven irrelevantes» (owner).
 * Changing it is turning it off (= end) and on again, which starts a new run.
 */
function assertNotTemplate(current: Campaign): void {
  if (current.templateKey !== null)
    throw new CampaignError(
      409,
      "template_not_editable",
      "Una campaña prearmada no se edita: apagala y encendé una nueva.",
    );
}

export async function updateCampaign(
  businessId: string,
  id: string,
  body: unknown,
): Promise<Campaign> {
  const current = await getCampaign(businessId, id);
  assertNotTemplate(current);
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
    await assertOwnProduct(tx, businessId, input.couponProductId);
    await assertExtrasFitProgram(tx, businessId, input.couponKind);
    await tx
      .update(campaigns)
      .set({ ...campaignFields(input), updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.businessId, businessId)));
    await writeDoors(tx, id, doors);
  });
  return await getCampaign(businessId, id);
}
