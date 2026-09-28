import type { FieldErrors } from "./campaign-input";
import { type CouponDeal, parseCoupon } from "./reward-input";
import type { TemplateDefinition, WelcomeRedeemFrom } from "./templates";

/**
 * THE «BIENVENIDA» HALF OF `enable`'s BODY (spec 0107 §2 / ADR 0099). PURE, called only by
 * `parseTemplateInput` (`template-input.ts`); apart for the size budget.
 *
 *  - In `welcome`: no `channels`, no `dormantDays`, no excluded doors (the offer is the
 *    program's, not a door's) — present → 400 on that field. The coupon is MANDATORY and has
 *    NO `couponMaxRedemptions` (the brake is the monthly cap, ADR 0099). The four
 *    `welcome*` are checked against the template's definition and default when absent;
 *    the reminder has to fall strictly inside the validity.
 *  - In ANY OTHER template, a `welcome*` key present is a 400 on that field.
 */

export type WelcomeParams = {
  welcomeValidDays: number | null;
  welcomeReminderDays: number | null;
  welcomeMonthlyCap: number | null;
  welcomeRedeemFrom: WelcomeRedeemFrom | null;
};

export const WELCOME_KEYS = [
  "welcomeValidDays",
  "welcomeReminderDays",
  "welcomeMonthlyCap",
  "welcomeRedeemFrom",
] as const satisfies readonly (keyof WelcomeParams)[];

const NO_WELCOME: WelcomeParams = {
  welcomeValidDays: null,
  welcomeReminderDays: null,
  welcomeMonthlyCap: null,
  welcomeRedeemFrom: null,
};

/** Only the four welcome parameters of a wider input, ready for an insert. */
export function pickWelcome(input: WelcomeParams): WelcomeParams {
  const { welcomeValidDays, welcomeReminderDays } = input;
  const { welcomeMonthlyCap, welcomeRedeemFrom } = input;
  return {
    welcomeValidDays,
    welcomeReminderDays,
    welcomeMonthlyCap,
    welcomeRedeemFrom,
  };
}

/** The column's own default (`core.campaign.dormant_days`): stored, never read. */
export const WELCOME_STORED_DORMANT_DAYS = 30;

const absent = (raw: unknown) => raw === undefined || raw === null;

function option<T>(
  errors: FieldErrors,
  raw: unknown,
  field: string,
  label: string,
  spec: { options: readonly T[]; default: T },
): T | undefined {
  if (absent(raw)) return spec.default;
  if (!spec.options.includes(raw as T)) {
    errors[field] = `${label} tiene que ser ${spec.options.join(", ")}.`;
    return undefined;
  }
  return raw as T;
}

/** The four parameters, or `undefined` with their errors written. */
export function welcomeParams(
  errors: FieldErrors,
  body: Record<string, unknown>,
  template: TemplateDefinition,
): WelcomeParams | undefined {
  const def = template.welcome;
  if (!def) {
    const foreign = WELCOME_KEYS.filter((key) => !absent(body[key]));
    for (const key of foreign)
      errors[key] = "Este campo es solo de la campaña «Bienvenida».";
    return foreign.length > 0 ? undefined : NO_WELCOME;
  }
  const validDays = option(
    errors,
    body.welcomeValidDays,
    "welcomeValidDays",
    "La vigencia (días)",
    def.validDays,
  );
  const reminderDays = option(
    errors,
    body.welcomeReminderDays,
    "welcomeReminderDays",
    "El aviso (días antes)",
    def.reminderDays,
  );
  if (
    validDays !== undefined &&
    reminderDays !== undefined &&
    reminderDays >= validDays
  ) {
    errors.welcomeReminderDays =
      "El aviso tiene que ser antes del vencimiento: elegí menos días.";
  }
  const cap = absent(body.welcomeMonthlyCap)
    ? def.monthlyCap.default
    : body.welcomeMonthlyCap;
  if (
    typeof cap !== "number" ||
    !Number.isInteger(cap) ||
    cap < def.monthlyCap.min ||
    cap > def.monthlyCap.max
  )
    errors.welcomeMonthlyCap = `El tope mensual tiene que ser un entero entre ${def.monthlyCap.min} y ${def.monthlyCap.max}.`;
  const redeemFrom = option(
    errors,
    body.welcomeRedeemFrom,
    "welcomeRedeemFrom",
    "Desde cuándo vale",
    def.redeemFrom,
  );
  if (WELCOME_KEYS.some((key) => key in errors)) return undefined;
  return {
    welcomeValidDays: validDays as number,
    welcomeReminderDays: reminderDays as number,
    welcomeMonthlyCap: cap as number,
    welcomeRedeemFrom: redeemFrom as WelcomeRedeemFrom,
  };
}

/**
 * The shape rules of a `welcome` body (channels, dormant days, doors) — each present one is
 * its own 400 — and its MANDATORY coupon without a redemption cap. The composer's parser is
 * reused so the reward is refused with the same messages everywhere (spec 0106); the cap it
 * demands is fed a placeholder and dropped.
 */
export function welcomeDeal(
  errors: FieldErrors,
  body: Record<string, unknown>,
): CouponDeal | undefined {
  if (!absent(body.channels))
    errors.channels =
      "La bienvenida no sale por un canal: se entrega al instalar el pase.";
  if (!absent(body.dormantDays))
    errors.dormantDays = "La bienvenida no usa días sin venir.";
  if (
    !absent(body.excludedLocationIds) &&
    !(
      Array.isArray(body.excludedLocationIds) &&
      body.excludedLocationIds.length === 0
    )
  )
    errors.excludedLocationIds =
      "La bienvenida es del programa: no excluye locales.";
  if (!absent(body.couponMaxRedemptions)) {
    errors.couponMaxRedemptions =
      "La bienvenida no lleva tope de canjes: el freno es el tope mensual.";
    return undefined;
  }
  if (absent(body.couponLabel) || absent(body.couponCost)) {
    errors.couponLabel =
      "La bienvenida necesita un premio: etiqueta y costo estimado.";
    return undefined;
  }
  const deal = parseCoupon(errors, { ...body, couponMaxRedemptions: 1 });
  return deal && { ...deal, couponMaxRedemptions: null };
}
