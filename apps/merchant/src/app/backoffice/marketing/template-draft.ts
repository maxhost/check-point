import type {
  Channel,
  CouponKind,
  TemplateView,
  WelcomeRedeemFrom,
} from "./marketing-types";
import { businessDateIso } from "./marketing-date";
import {
  emptyReward,
  rewardBody,
  rewardErrors,
  type RewardDraft,
} from "./reward-draft";

export type TemplateDraft = RewardDraft & {
  channels: Channel[];
  dormantDays: number | null;
  message: string;
  excludedLocationIds: string[];
  coupon: boolean;
  nearRewardStamps: number | null;
  nearRewardPercent: number | null;
  rewardRepeat: "once" | "every_30_days" | null;
  startsAt: string;
  endsAt: string;
  welcomeValidDays: number | null;
  welcomeReminderDays: number | null;
  welcomeMonthlyCap: number | null;
  welcomeRedeemFrom: WelcomeRedeemFrom | null;
};

export function initialTemplateDraft(template: TemplateView): TemplateDraft {
  return {
    channels: [...template.channels],
    dormantDays: template.dormantDays?.default ?? null,
    message: template.message.default,
    excludedLocationIds: [],
    coupon: template.couponRequired,
    ...emptyReward(),
    nearRewardStamps: template.nearReward?.stamps.default ?? null,
    nearRewardPercent: template.nearReward?.pointsPercent.default ?? null,
    rewardRepeat: template.repeat?.default ?? null,
    startsAt: "",
    endsAt: "",
    welcomeValidDays: template.welcome?.validDays.default ?? null,
    welcomeReminderDays: template.welcome?.reminderDays.default ?? null,
    welcomeMonthlyCap: template.welcome?.monthlyCap.default ?? null,
    welcomeRedeemFrom: template.welcome?.redeemFrom.default ?? null,
  };
}

export function templateDraftErrors(
  template: TemplateView,
  draft: TemplateDraft,
  timeZone: string,
  couponKinds?: CouponKind[],
) {
  const errors: Record<string, string> = {};
  if (
    !template.welcome &&
    (!draft.channels.length ||
      draft.channels.some((channel) => !template.channels.includes(channel)))
  )
    errors.channels = "Elegí al menos un canal disponible.";
  if (
    template.dormantDays &&
    !template.dormantDays.options.includes(draft.dormantDays ?? NaN)
  )
    errors.dormantDays = "Elegí una opción de días.";
  const message = draft.message.trim();
  if (!message || message.length > template.message.maxLength)
    errors.message = `Escribí entre 1 y ${template.message.maxLength} caracteres.`;
  if (template.message.gapMarker && !message.includes("{faltan}"))
    errors.message = "El mensaje tiene que incluir {faltan}.";
  if (!template.message.gapMarker && message.includes("{faltan}"))
    errors.message = "El marcador {faltan} solo vale en «Te falta poco».";
  if (draft.startsAt && !businessDateIso(draft.startsAt, timeZone))
    errors.startsAt = "Ingresá una fecha válida.";
  const start = draft.startsAt
    ? businessDateIso(draft.startsAt, timeZone)
    : new Date().toISOString();
  const end = draft.endsAt ? businessDateIso(draft.endsAt, timeZone) : null;
  if (draft.endsAt && !end) errors.endsAt = "Ingresá una fecha válida.";
  if (end && start && end <= start)
    errors.endsAt = "La fecha de fin debe ser posterior al inicio.";
  if (template.couponRequired && !draft.coupon)
    errors.couponLabel = "La bienvenida necesita un premio.";
  if (draft.coupon) {
    Object.assign(errors, rewardErrors(draft, couponKinds, !template.welcome));
    if (!end && !template.welcome)
      errors.endsAt = "Una campaña con cupón necesita fecha de fin.";
  }
  if (template.welcome) {
    const welcome = template.welcome;
    if (!welcome.validDays.options.includes(draft.welcomeValidDays ?? NaN))
      errors.welcomeValidDays = "Elegí una vigencia disponible.";
    if (
      !welcome.reminderDays.options.includes(
        draft.welcomeReminderDays ?? NaN,
      ) ||
      (draft.welcomeReminderDays ?? Infinity) >= (draft.welcomeValidDays ?? 0)
    )
      errors.welcomeReminderDays = "Elegí un aviso anterior al vencimiento.";
    if (
      !Number.isInteger(draft.welcomeMonthlyCap) ||
      (draft.welcomeMonthlyCap ?? 0) < welcome.monthlyCap.min ||
      (draft.welcomeMonthlyCap ?? Infinity) > welcome.monthlyCap.max
    )
      errors.welcomeMonthlyCap = `Elegí un tope entre ${welcome.monthlyCap.min} y ${welcome.monthlyCap.max}.`;
    if (
      !welcome.redeemFrom.options.includes(
        draft.welcomeRedeemFrom as WelcomeRedeemFrom,
      )
    )
      errors.welcomeRedeemFrom = "Elegí desde cuándo vale el regalo.";
  }
  if (template.nearReward) {
    if (
      !template.nearReward.stamps.options.includes(
        draft.nearRewardStamps ?? NaN,
      )
    )
      errors.nearRewardStamps = "Elegí un umbral de sellos.";
    if (
      !template.nearReward.pointsPercent.options.includes(
        draft.nearRewardPercent ?? NaN,
      )
    )
      errors.nearRewardPercent = "Elegí un porcentaje.";
  }
  if (
    template.repeat &&
    !template.repeat.options.includes(
      draft.rewardRepeat as "once" | "every_30_days",
    )
  )
    errors.rewardRepeat = "Elegí una frecuencia.";
  return errors;
}

export function templateDraftBody(
  template: TemplateView,
  draft: TemplateDraft,
  timeZone: string,
  includeExcludedLocationIds = true,
) {
  return {
    ...(template.welcome
      ? {
          welcomeValidDays: draft.welcomeValidDays,
          welcomeReminderDays: draft.welcomeReminderDays,
          welcomeMonthlyCap: draft.welcomeMonthlyCap,
          welcomeRedeemFrom: draft.welcomeRedeemFrom,
        }
      : { channels: draft.channels, dormantDays: draft.dormantDays }),
    message: draft.message.trim(),
    ...(!template.welcome && includeExcludedLocationIds
      ? { excludedLocationIds: draft.excludedLocationIds }
      : {}),
    ...(draft.startsAt
      ? { startsAt: businessDateIso(draft.startsAt, timeZone) }
      : {}),
    endsAt: draft.endsAt ? businessDateIso(draft.endsAt, timeZone) : null,
    ...(draft.coupon && template.couponAllowed
      ? rewardBody(draft, true, !template.welcome)
      : {}),
    ...(template.nearReward
      ? {
          nearRewardStamps: draft.nearRewardStamps,
          nearRewardPercent: draft.nearRewardPercent,
        }
      : {}),
    ...(template.repeat ? { rewardRepeat: draft.rewardRepeat } : {}),
  };
}
