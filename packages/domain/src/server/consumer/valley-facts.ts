import type { CrossOfferFacts } from "../marketing/cross-rules";
import {
  type CrossCampaign,
  type CrossLocation,
  type Db,
  countMonthCrossCoupons,
} from "../marketing/cross-store";
import {
  type ValleyWindow,
  effectiveWindows,
  localClock,
  openWindow,
  windowEndsAt,
} from "../marketing/valley-rules";
import type { WindowRow } from "../marketing/valley-store";
import { localMonthStart } from "../marketing/welcome-rules";
import {
  type CrossMembershipRow,
  type CrossOffer,
  toOffer,
} from "./cross-facts";

/**
 * THE PIECES OF A VALLEY OFFER (spec 0113): which locations of a campaign have their
 * window OPEN now, the facts `decideCrossOffer` is asked with (`offer.locations = [that
 * location]`, `audience = "not_active"`), the month's count and the offer's DTO. The list
 * and the claim that use them are `valley-offers.ts`; apart only for the size budget.
 */

export type ValleyOffer = Omit<CrossOffer, "type" | "validDays"> & {
  type: "valley";
  validDays: null;
  locationId: string;
  window: { startHour: number; endHour: number; endsAt: Date };
};

export type OpenSlot = {
  location: CrossLocation;
  window: ValleyWindow;
  endsAt: Date;
};

/** The campaign's locations whose ruling window is OPEN at `now`, with today's close. */
export function openSlots(
  campaign: CrossCampaign,
  locations: readonly CrossLocation[],
  windows: Map<string, WindowRow[]>,
  now: Date,
): OpenSlot[] {
  const clock = localClock(now, campaign.timeZone);
  const slots: OpenSlot[] = [];
  for (const location of locations) {
    if (location.businessId !== campaign.businessId) continue;
    const ruling = effectiveWindows(windows.get(location.id) ?? []).windows;
    const window = openWindow(ruling, clock);
    if (window)
      slots.push({
        location,
        window,
        endsAt: windowEndsAt(clock, window, campaign.timeZone),
      });
  }
  return slots;
}

export function valleyFacts(
  campaign: CrossCampaign,
  slot: OpenSlot,
  base: Pick<CrossOfferFacts, "now" | "position">,
  membership: CrossMembershipRow | null,
  claimed: boolean,
  claimedThisMonth: number,
): CrossOfferFacts {
  return {
    ...base,
    offer: {
      categoryGcid: campaign.categoryGcid,
      audience: campaign.audience,
      dormantDays: campaign.dormantDays,
      monthlyCap: campaign.monthlyCap,
      locations: [slot.location],
    },
    membership,
    claimed,
    claimedThisMonth,
  };
}

export const monthCount = (db: Db, campaign: CrossCampaign, now: Date) =>
  countMonthCrossCoupons(
    db,
    campaign.id,
    localMonthStart(now, campaign.timeZone),
  );

export function toValleyOffer(
  campaign: CrossCampaign,
  slot: OpenSlot,
  meters: number,
): ValleyOffer {
  return {
    ...toOffer(campaign, slot.location, meters),
    type: "valley",
    validDays: null,
    locationId: slot.location.id,
    window: {
      startHour: slot.window.startHour,
      endHour: slot.window.endHour,
      endsAt: slot.endsAt,
    },
  };
}
