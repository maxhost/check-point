import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  campaignLocations,
  campaigns,
  locations,
} from "@mi-pasaporte/db/schema";
import { transitionCampaign } from "./campaign-actions";
import { type Campaign, CampaignError, getCampaign } from "./campaign-store";
import {
  PLAN_NOT_ALLOWED_MESSAGE,
  planAllowsCampaigns,
} from "@mi-pasaporte/domain/server/marketing/plan-gate";
import { loadRewardCost } from "./balance-store";
import { parseTemplateInput } from "./template-input";
import { pickReward } from "@mi-pasaporte/domain/server/marketing/reward-input";
import { assertExtrasFitProgram, assertOwnProduct } from "./reward-store";
import {
  TEMPLATES,
  type TemplateDefinition,
  templateByKey,
} from "@mi-pasaporte/domain/server/marketing/templates";
import { pickWelcome } from "./welcome-input";
import { pickCross } from "./cross-input";
import { pickValley } from "./valley-input";

/**
 * The prebuilt campaigns against the database (spec 0101 / ADR 0092). A template run is
 * a plain `core.campaign` with `template_key`: everything downstream —the tick, the
 * results, pause/activate/end/archive— treats it like any campaign. What is new lives
 * here: turning one on (create AND activate in one transaction), turning it off (= `end`)
 * and the list the UI paints as cards.
 *
 * Everything is scoped by the SESSION's `business_id`, as in `campaign-store.ts`.
 */

/** The states that hold `core_campaign_template_live_unique`: one run of these per
 * business and template. */
const LIVE_STATUSES = ["draft", "active", "paused"] as const;
const RUNS_SHOWN = 10;
const LIVE_UNIQUE = "core_campaign_template_live_unique";

export type TemplateRun = {
  id: string;
  status: "ended" | "archived";
  activatedAt: Date | null;
  endedAt: Date | null;
};

export type TemplateView = TemplateDefinition & {
  live: Campaign | null;
  runs: TemplateRun[];
};

function unknownTemplate(): CampaignError {
  return new CampaignError(404, "not_found", "No existe esa plantilla.");
}

function alreadyLive(): CampaignError {
  return new CampaignError(
    409,
    "template_already_live",
    "Esa campaña ya está encendida.",
  );
}

/** `23505` over THIS index, in the error or any of its `cause`s. Another unique
 * violation is not «already live» and must not be reported as if it were. */
function isLiveUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const pg = current as { code?: unknown; constraint?: unknown };
    if (pg.code === "23505" && pg.constraint === LIVE_UNIQUE) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function liveRunId(
  db: DbTransaction | ReturnType<typeof getDb>,
  businessId: string,
  key: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.businessId, businessId),
        eq(campaigns.templateKey, key),
        inArray(campaigns.status, [...LIVE_STATUSES]),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * The doors of a run: every location of the business the tick can use (`active` AND
 * geocoded, the same three conditions `activate` demands) MINUS the excluded ones. An
 * excluded id that is not a location of this business is a 400, not a silent no-op: the
 * UI would otherwise believe it excluded a door it never had.
 */
async function runDoors(
  tx: DbTransaction,
  businessId: string,
  excludedIds: string[],
): Promise<string[]> {
  if (excludedIds.length > 0) {
    const own = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.businessId, businessId),
          inArray(locations.id, excludedIds),
        ),
      );
    if (own.length !== excludedIds.length)
      throw new CampaignError(
        400,
        "validation",
        "Revisá los locales excluidos.",
        { excludedLocationIds: "Hay un local que no es tuyo o no existe." },
      );
  }
  const usable = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        eq(locations.status, "active"),
        isNotNull(locations.latitude),
        isNotNull(locations.longitude),
      ),
    );
  const excluded = new Set(excludedIds);
  return usable.map((row) => row.id).filter((id) => !excluded.has(id));
}

/** `POST /api/marketing/templates/{key}/enable` — creates the run already `active`. */
export async function enableTemplate(
  businessId: string,
  userId: string,
  key: string,
  body: unknown,
  now: Date = new Date(),
): Promise<Campaign> {
  const template = templateByKey(key);
  if (!template) throw unknownTemplate();
  const parsed = parseTemplateInput(template, body, now);
  if (!parsed.ok)
    throw new CampaignError(
      400,
      "validation",
      "Revisá los datos de la campaña.",
      parsed.errors,
    );
  const input = parsed.value;
  let id: string;
  try {
    id = await withDbTransaction(async (tx) => {
      if (!(await planAllowsCampaigns(tx, businessId)))
        throw new CampaignError(
          402,
          "plan_not_allowed",
          PLAN_NOT_ALLOWED_MESSAGE,
        );
      // Spec 0104 §3: a BALANCE template measures the balance against a reward; without
      // one it would run forever with an empty audience. The UI shows it as a toast.
      if (
        template.group === "balance" &&
        (await loadRewardCost(tx, businessId)) === null
      )
        throw new CampaignError(
          409,
          "no_loyalty_reward",
          "No se puede activar: necesitás un programa de fidelización con un premio.",
        );
      const doors = await runDoors(tx, businessId, input.excludedLocationIds);
      // Spec 0103: the doors are PROXIMITY's. A push-only run needs none, and is created
      // with no `campaign_location` rows at all.
      if (input.channelProximity && doors.length === 0)
        throw new CampaignError(
          409,
          "no_usable_location",
          "Necesitás al menos un local activo y con ubicación en el mapa.",
        );
      if (input.endsAt !== null && input.endsAt <= now)
        throw new CampaignError(
          409,
          "campaign_expired",
          "La fecha de fin ya pasó: elegí otra.",
        );
      // Answers fast in the common case. What GUARANTEES one live run is the partial
      // unique index: when two requests truly overlap (the second one's select runs before
      // the first commits) both pass this select, and the loser gets the `23505` mapped in
      // the `catch` below — pinned by `marketing-templates-race.neon.integration.test.ts`.
      if ((await liveRunId(tx, businessId, template.key)) !== null)
        throw alreadyLive();
      await assertOwnProduct(tx, businessId, input.couponProductId);
      await assertExtrasFitProgram(tx, businessId, input.couponKind);
      const [created] = await tx
        .insert(campaigns)
        .values({
          businessId,
          kind: "proximity",
          templateKey: template.key,
          channelProximity: input.channelProximity,
          channelPush: input.channelPush,
          name: template.title,
          status: "active",
          activatedAt: now,
          createdByUserId: userId,
          dormantDays: input.dormantDays,
          message: input.message,
          ...pickReward(input),
          nearRewardStamps: input.nearRewardStamps,
          nearRewardPercent: input.nearRewardPercent,
          rewardRepeat: input.rewardRepeat,
          ...pickWelcome(input),
          ...pickCross(input),
          ...pickValley(input),
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        })
        .returning({ id: campaigns.id });
      if (doors.length > 0)
        await tx
          .insert(campaignLocations)
          .values(
            doors.map((locationId) => ({ campaignId: created.id, locationId })),
          );
      return created.id;
    });
  } catch (error) {
    if (isLiveUniqueViolation(error)) throw alreadyLive();
    throw error;
  }
  return await getCampaign(businessId, id);
}

/** `POST /api/marketing/templates/{key}/disable` — apagar = FINALIZAR (ADR 0092 §4). */
export async function disableTemplate(
  businessId: string,
  key: string,
): Promise<{ campaign: Campaign; notice?: string }> {
  const template = templateByKey(key);
  if (!template) throw unknownTemplate();
  const id = await liveRunId(getDb(), businessId, template.key);
  if (id === null)
    throw new CampaignError(
      404,
      "template_not_live",
      "Esa campaña no está encendida.",
    );
  return await transitionCampaign(businessId, id, "end");
}

/** `GET /api/marketing/templates` — the cards, in catalog order. */
export async function listTemplates(
  businessId: string,
): Promise<TemplateView[]> {
  const rows = await getDb()
    .select({
      id: campaigns.id,
      templateKey: campaigns.templateKey,
      status: campaigns.status,
      activatedAt: campaigns.activatedAt,
      endedAt: campaigns.endedAt,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.businessId, businessId),
        isNotNull(campaigns.templateKey),
      ),
    )
    .orderBy(
      sql`${campaigns.activatedAt} desc nulls last`,
      desc(campaigns.createdAt),
    );
  return await Promise.all(
    TEMPLATES.map(async (template) => {
      const mine = rows.filter((row) => row.templateKey === template.key);
      const live = mine.find((row) =>
        (LIVE_STATUSES as readonly string[]).includes(row.status),
      );
      return {
        ...template,
        live: live ? await getCampaign(businessId, live.id) : null,
        runs: mine
          .filter((row) => row.status === "ended" || row.status === "archived")
          .slice(0, RUNS_SHOWN)
          .map((row) => ({
            id: row.id,
            status: row.status as TemplateRun["status"],
            activatedAt: row.activatedAt,
            endedAt: row.endedAt,
          })),
      };
    }),
  );
}
