/**
 * The composer's local state and the body it sends. Pure, and split from the component
 * for the same reason `composer-summary.ts` is: what the screen SENDS is a decision, and
 * a decision has a table of cases as an oracle.
 *
 * Dates travel as the `yyyy-mm-dd` of the `<input type="date">`, untouched. The server's
 * `when()` runs `new Date(raw)`, and for that spelling the result is unambiguous UTC
 * midnight — building an ISO string here with the browser's offset would silently move a
 * campaign a day back for anyone west of Greenwich.
 */

export type ComposerDraft = {
  name: string;
  dormantDays: number;
  locationIds: string[];
  message: string;
  withCoupon: boolean;
  couponLabel: string;
  couponCost: string;
  couponMaxRedemptions: string;
  couponProductId: string;
  startsAt: string;
  endsAt: string;
};

/** ≤ 60 characters, the same cap `core_campaign_message_check` enforces. Declared here
 * so the counter under the textarea and the server cannot disagree. */
export const MESSAGE_MAX = 60;
export const COUPON_LABEL_MAX = 40;
export const DEFAULT_DORMANT_DAYS = 30;

export function emptyDraft(
  today: string,
  locationIds: string[],
): ComposerDraft {
  return {
    name: "",
    dormantDays: DEFAULT_DORMANT_DAYS,
    // Every active door preselected: the campaign the owner wants by default is «en
    // todos mis locales», and an empty selection previews an audience of nobody.
    locationIds,
    message: "",
    withCoupon: false,
    couponLabel: "",
    couponCost: "",
    couponMaxRedemptions: "",
    couponProductId: "",
    startsAt: today,
    endsAt: "",
  };
}

export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The coupon travels as a TRIO or not at all — the same rule `parseCampaignInput`
 * applies and `core_campaign_coupon_check` enforces. Sending `couponCost` alone over a
 * campaign with no label builds exactly the half-declared state the database refuses,
 * and the owner would read a 400 about a field they never filled.
 */
export function draftBody(draft: ComposerDraft): Record<string, unknown> {
  return {
    name: draft.name.trim(),
    message: draft.message.trim(),
    dormantDays: draft.dormantDays,
    locationIds: draft.locationIds,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt === "" ? null : draft.endsAt,
    couponLabel: draft.withCoupon ? draft.couponLabel.trim() : null,
    couponCost: draft.withCoupon ? draft.couponCost : null,
    couponMaxRedemptions: draft.withCoupon
      ? Number(draft.couponMaxRedemptions)
      : null,
    // Informative (ADR 0002) and never required, so an empty pick is `null` and not the
    // empty string: `parseCampaignInput` validates it as a uuid when it is present, and
    // `""` would come back as a `validation` error over a field the owner left alone.
    couponProductId:
      draft.withCoupon && draft.couponProductId !== ""
        ? draft.couponProductId
        : null,
  };
}

/** What `summarizeComposer` needs from the draft: the coupon, or nothing. A cap that is
 * not a whole number is handed over as `null` rather than as `NaN` — the summary would
 * otherwise print «NaN» as the maximum cost while the owner is still typing. */
export function draftCoupon(draft: ComposerDraft): {
  couponCost: string | null;
  couponMaxRedemptions: number | null;
} {
  if (!draft.withCoupon)
    return { couponCost: null, couponMaxRedemptions: null };
  const cap = Number(draft.couponMaxRedemptions);
  return {
    couponCost: draft.couponCost.trim() === "" ? null : draft.couponCost,
    couponMaxRedemptions: Number.isInteger(cap) && cap > 0 ? cap : null,
  };
}

/**
 * The draft of an EXISTING campaign, for the edit screen. Dates come back as `Date` from
 * the store and go into an `<input type="date">`, which only ever accepts `yyyy-mm-dd`:
 * `toISOString().slice(0,10)` is the only spelling that round-trips, and it is the same
 * one `draftBody` sends back.
 */
export function draftFromCampaign(campaign: {
  name: string;
  dormantDays: number;
  message: string;
  locationIds: string[];
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
  startsAt: Date;
  endsAt: Date | null;
}): ComposerDraft {
  return {
    name: campaign.name,
    dormantDays: campaign.dormantDays,
    locationIds: [...campaign.locationIds],
    message: campaign.message,
    withCoupon: campaign.couponLabel !== null,
    couponLabel: campaign.couponLabel ?? "",
    couponCost: campaign.couponCost ?? "",
    couponMaxRedemptions:
      campaign.couponMaxRedemptions === null
        ? ""
        : String(campaign.couponMaxRedemptions),
    couponProductId: campaign.couponProductId ?? "",
    startsAt: campaign.startsAt.toISOString().slice(0, 10),
    endsAt:
      campaign.endsAt === null
        ? ""
        : campaign.endsAt.toISOString().slice(0, 10),
  };
}
