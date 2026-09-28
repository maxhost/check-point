import type { Campaign } from "./marketing-types";
import { businessDateIso, localBusinessDate } from "./marketing-date";

export type CustomDraft = {
  name: string;
  dormantDays: number;
  locationIds: string[];
  message: string;
  coupon: boolean;
  couponLabel: string;
  couponCost: string;
  couponMaxRedemptions: number;
  couponProductId: string | null;
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
        couponLabel: campaign.couponLabel ?? "",
        couponCost: campaign.couponCost ?? "",
        couponMaxRedemptions: campaign.couponMaxRedemptions ?? 100,
        couponProductId: campaign.couponProductId,
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
        couponLabel: "",
        couponCost: "",
        couponMaxRedemptions: 100,
        couponProductId: null,
        startsAt: "",
        endsAt: "",
      };
}

export function customErrors(draft: CustomDraft, timeZone: string) {
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
    if (!draft.couponLabel.trim() || draft.couponLabel.trim().length > 40)
      fields.couponLabel = "Escribí un nombre de hasta 40 caracteres.";
    if (
      !draft.couponCost.trim() ||
      !Number.isFinite(Number(draft.couponCost)) ||
      Number(draft.couponCost) < 0
    )
      fields.couponCost = "Ingresá un costo válido.";
    if (
      !Number.isInteger(draft.couponMaxRedemptions) ||
      draft.couponMaxRedemptions < 1 ||
      draft.couponMaxRedemptions > 1_000_000
    )
      fields.couponMaxRedemptions = "Elegí entre 1 y 1.000.000 canjes.";
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
    couponLabel: draft.coupon ? draft.couponLabel.trim() : null,
    couponCost: draft.coupon ? draft.couponCost.trim() : null,
    couponMaxRedemptions: draft.coupon ? draft.couponMaxRedemptions : null,
    couponProductId: draft.coupon ? draft.couponProductId : null,
  };
}
