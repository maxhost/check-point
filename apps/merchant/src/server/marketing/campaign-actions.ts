import { and, eq, isNotNull } from "drizzle-orm";
import { withDbTransaction } from "../db";
import { campaignLocations, campaigns, locations } from "../schema";
import { CampaignError, type Campaign, getCampaign } from "./campaign-store";
import { type CampaignAction, nextStatus } from "./campaign-transitions";
import { PLAN_NOT_ALLOWED_MESSAGE, planAllowsCampaigns } from "./plan-gate";

/**
 * The four buttons of the detail page (spec 0065 phase B). They move `status` and
 * NOTHING else: retiring the live turns of a paused or ended campaign is step 3 of the
 * tick, which is also what writes each turn's `cancel_reason`. Every answer carries
 * {@link TURNS_NOTICE} for the two actions that leave turns behind, because an owner who
 * reads «pausada» and still sees the door on their own pass would think it failed.
 */

/** Said by `pause` and `end`, whose effect on the pass is NOT immediate. */
export const TURNS_NOTICE =
  "Los turnos activos se retiran en el próximo refresco.";

/**
 * Activating needs a door the tick can actually use: assigned to the campaign, `active`
 * and GEOCODED. The three conditions are one query on purpose — «tenés un local pero sin
 * coordenadas» and «no tenés ninguno asignado» land the owner in the same place, and the
 * tick would otherwise queue a turn only to cancel it on the same run.
 */
async function usableDoors(
  tx: Parameters<Parameters<typeof withDbTransaction>[0]>[0],
  campaignId: string,
): Promise<number> {
  const rows = await tx
    .select({ id: locations.id })
    .from(campaignLocations)
    .innerJoin(locations, eq(locations.id, campaignLocations.locationId))
    .where(
      and(
        eq(campaignLocations.campaignId, campaignId),
        eq(locations.status, "active"),
        isNotNull(locations.latitude),
        isNotNull(locations.longitude),
      ),
    );
  return rows.length;
}

export async function transitionCampaign(
  businessId: string,
  id: string,
  action: CampaignAction,
  now: Date = new Date(),
): Promise<{ campaign: Campaign; notice?: string }> {
  const current = await getCampaign(businessId, id);
  const next = nextStatus(current.status, action);
  if (next === null)
    throw new CampaignError(
      409,
      "invalid_transition",
      `Una campaña ${current.status} no admite esa acción.`,
    );

  await withDbTransaction(async (tx) => {
    if (action === "activate") {
      // El gate de plan (402) vive en `plan-gate.ts` y lo comparte con `createCampaign`:
      // componer y activar exigen lo mismo. La versión de B1 que vivía acá miraba sólo
      // `plan === 'plus'`; ver el docblock de `campaignsAllowedFor` por qué eso no alcanza.
      if (!(await planAllowsCampaigns(tx, businessId)))
        throw new CampaignError(
          402,
          "plan_not_allowed",
          PLAN_NOT_ALLOWED_MESSAGE,
        );
      if ((await usableDoors(tx, id)) === 0)
        throw new CampaignError(
          409,
          "no_usable_location",
          "Necesitás al menos un local activo y con ubicación en el mapa.",
        );
      // «fechas validas» of the spec, read at its narrowest: a campaign whose end has
      // already passed would be activated and ended by the very next tick. Anything
      // beyond that (a start in the past, for instance) is legitimate — the tick queues
      // from `starts_at`, so activating a campaign that already started is normal.
      if (current.endsAt !== null && current.endsAt <= now)
        throw new CampaignError(
          409,
          "campaign_expired",
          "La fecha de fin ya pasó: cambiala antes de activar.",
        );
    }

    await tx
      .update(campaigns)
      .set({
        status: next,
        // `pause_reason` is cleared on the way IN to `active` and written on the way out
        // by the owner's own hand. The other two values (`plan_downgraded`,
        // `no_active_locations`) are written by billing and by the tick, never here.
        pauseReason:
          action === "activate"
            ? null
            : action === "pause"
              ? "owner"
              : current.pauseReason,
        // First activation wins: `activated_at` answers «desde cuándo existe esta
        // campaña», and overwriting it on every resume would erase that. DECISION OF THE
        // ORCHESTRATOR — the spec names the column without saying which reading.
        activatedAt:
          action === "activate"
            ? (current.activatedAt ?? now)
            : current.activatedAt,
        endedAt: action === "end" ? now : current.endedAt,
        updatedAt: now,
      })
      .where(and(eq(campaigns.id, id), eq(campaigns.businessId, businessId)));
  });

  const campaign = await getCampaign(businessId, id);
  return action === "pause" || action === "end"
    ? { campaign, notice: TURNS_NOTICE }
    : { campaign };
}
