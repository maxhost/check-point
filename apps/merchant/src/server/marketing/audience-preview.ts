/**
 * The counts the composer shows BEFORE a campaign exists (spec 0065,
 * `GET /api/marketing/audience-preview`). It answers the same question step 1 of the
 * tick answers, with the same pure decision — `decideTurnEligibility` — over a campaign
 * that has not been saved: the owner is choosing `dormantDays` and doors and wants to
 * know «a cuánta gente le llega esto».
 *
 * Reusing the tick's decision is the point. A preview with its own `where` would drift
 * from the engine on the first change and quietly promise an audience the tick would
 * never queue; here, the number on the screen is wrong only if the tick is wrong too.
 *
 * Two rules are evaluated against LIVE rows and are therefore honest but volatile:
 * `cooldown` and `live_turn` look at turns that exist right now, so a consumer excluded
 * today may be eligible when the campaign is finally activated. That is why the preview
 * reports the exclusion tallies and not a promise.
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { withDbTransaction } from "../db";
import { locations } from "../schema";
import {
  decideTurnEligibility,
  summarizeAudience,
  type AudienceCandidate,
  type Eligibility,
} from "./audience";
import { loadAudienceCandidates } from "./audience-store";
import { CampaignError } from "./campaign-store";
import { DEFAULT_PLACEMENT_LIMITS } from "./placement-plan";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The same range the `core_campaign_dormant_days_check` enforces. */
const MIN_DORMANT_DAYS = 7;
const MAX_DORMANT_DAYS = 365;

export type AudiencePreviewQuery = {
  dormantDays: number;
  locationIds: string[];
};

export type AudiencePreview = {
  quality: "observada";
  total: number;
  reachable: number;
  noLocation: number;
  optOut: number;
  cooldown: number;
  /** How many would get a turn on a tick running right now. */
  eligible: number;
  /** Of the chosen doors, the ones the tick could actually use: owned by this business,
   * `active` and geocoded. The composer marks the difference — a door that is archived
   * or has no coordinates places nothing, and finding that out at `activate` (409) is
   * finding out too late. */
  usableLocationIds: string[];
};

/**
 * `?dormantDays=30&locationIds=<uuid>,<uuid>`. Errors come out as a 400 `validation`
 * with the message next to the field, exactly like the composer's other inputs — a
 * query string is user input like any other.
 *
 * An EMPTY `locationIds` is legal and not an error: the composer previews while the
 * owner is still choosing, and the honest answer then is «everybody falls in `sin local
 * atribuible`», which is what the decision returns on its own.
 */
export function parseAudiencePreviewQuery(
  params: URLSearchParams,
): AudiencePreviewQuery {
  const fields: Record<string, string> = {};
  const rawDays = params.get("dormantDays");
  const days = Number(rawDays);
  if (rawDays === null || !Number.isInteger(days))
    fields.dormantDays =
      "Los días de inactividad tienen que ser un número entero.";
  else if (days < MIN_DORMANT_DAYS || days > MAX_DORMANT_DAYS)
    fields.dormantDays = `Los días de inactividad tienen que estar entre ${MIN_DORMANT_DAYS} y ${MAX_DORMANT_DAYS}.`;
  const locationIds = (params.get("locationIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (locationIds.some((id) => !UUID.test(id)))
    fields.locationIds = "Hay un local con identificador inválido.";
  if (Object.keys(fields).length > 0)
    throw new CampaignError(
      400,
      "validation",
      "Revisá los datos de la audiencia.",
      fields,
    );
  return { dormantDays: days, locationIds };
}

/**
 * The chosen doors, narrowed to this business's usable ones. The `business_id` filter is
 * what stops the preview from becoming an oracle over somebody else's locations: without
 * it, an owner could pass a foreign id and learn from the counts whether it exists and
 * is geocoded.
 */
async function usableDoors(
  db: Parameters<Parameters<typeof withDbTransaction>[0]>[0],
  businessId: string,
  locationIds: string[],
): Promise<string[]> {
  if (locationIds.length === 0) return [];
  const rows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        inArray(locations.id, locationIds),
        eq(locations.status, "active"),
        isNotNull(locations.latitude),
        isNotNull(locations.longitude),
      ),
    );
  return rows.map((row) => row.id);
}

export async function previewAudience(
  businessId: string,
  query: AudiencePreviewQuery,
  now: Date = new Date(),
): Promise<AudiencePreview> {
  return await withDbTransaction(async (db) => {
    const usableLocationIds = await usableDoors(
      db,
      businessId,
      query.locationIds,
    );
    const candidates = await loadAudienceCandidates(db, businessId);
    const evaluated: {
      candidate: AudienceCandidate;
      eligibility: Eligibility;
    }[] = candidates.map((candidate) => ({
      candidate,
      eligibility: decideTurnEligibility(candidate, {
        now,
        dormantDays: query.dormantDays,
        cooldownDays: DEFAULT_PLACEMENT_LIMITS.cooldownDays,
        eligibleLocationIds: usableLocationIds,
      }),
    }));
    return {
      quality: "observada",
      ...summarizeAudience(evaluated),
      eligible: evaluated.filter((row) => row.eligibility.kind === "eligible")
        .length,
      usableLocationIds,
    };
  });
}
