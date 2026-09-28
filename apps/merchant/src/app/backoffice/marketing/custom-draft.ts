import type { Campaign, CouponKind } from "./marketing-types";
import { businessDateIso, localBusinessDate } from "./marketing-date";
import {
  emptyReward,
  rewardBody,
  rewardErrors,
  rewardFromCampaign,
  type RewardDraft,
} from "./reward-draft";

export type CustomDraft = RewardDraft & {
  name: string;
  dormantDays: number;
  locationIds: string[];
  message: string;
  coupon: boolean;
  startsAt: string;
  endsAt: string;
};

export function initialCustomDraft(
  campaign: Campaign | null,
  timeZone: string,
  locationIds: string[],
): CustomDraft {
  return campaign
    ? {
        name: campaign.name,
        dormantDays: campaign.dormantDays,
        locationIds: [...campaign.locationIds],
        message: campaign.message,
        coupon: campaign.couponLabel !== null,
        ...rewardFromCampaign(campaign),
        startsAt: localBusinessDate(campaign.startsAt, timeZone),
        endsAt: campaign.endsAt
          ? localBusinessDate(campaign.endsAt, timeZone)
          : "",
      }
    : {
        name: "",
        dormantDays: 30,
        locationIds,
        message: "",
        coupon: false,
        ...emptyReward(),
        startsAt: "",
        endsAt: "",
      };
}

export function customErrors(
  draft: CustomDraft,
  timeZone: string,
  couponKinds?: CouponKind[],
) {
  const fields: Record<string, string> = {};
  if (!draft.name.trim() || draft.name.trim().length > 80)
    fields.name = "Escribí un nombre de hasta 80 caracteres.";
  if (
    !Number.isInteger(draft.dormantDays) ||
    draft.dormantDays < 7 ||
    draft.dormantDays > 365
  )
    fields.dormantDays = "Elegí entre 7 y 365 días.";
  if (!draft.locationIds.length)
    fields.locationIds = "Elegí al menos un local.";
  if (!draft.message.trim() || draft.message.trim().length > 60)
    fields.message = "Escribí un mensaje de hasta 60 caracteres.";
  const start = businessDateIso(draft.startsAt, timeZone);
  const end = draft.endsAt ? businessDateIso(draft.endsAt, timeZone) : null;
  if (!start) fields.startsAt = "Elegí una fecha de inicio válida.";
  if (draft.endsAt && !end) fields.endsAt = "Elegí una fecha de fin válida.";
  if (start && end && end <= start)
    fields.endsAt = "El fin debe ser posterior al inicio.";
  if (draft.coupon) {
    Object.assign(fields, rewardErrors(draft, couponKinds));
    if (!end) fields.endsAt = "Una campaña con cupón necesita fecha de fin.";
  }
  return fields;
}

export function customBody(draft: CustomDraft, timeZone: string) {
  return {
    name: draft.name.trim(),
    dormantDays: draft.dormantDays,
    locationIds: draft.locationIds,
    message: draft.message.trim(),
    startsAt: businessDateIso(draft.startsAt, timeZone),
    endsAt: draft.endsAt ? businessDateIso(draft.endsAt, timeZone) : null,
    ...rewardBody(draft, draft.coupon),
  };
}
