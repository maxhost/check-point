import {
  type FieldErrors,
  type ParseResult,
  requireEndForCoupon,
} from "./campaign-input";
import { type CouponDeal, parseCoupon } from "./reward-input";
import { asObject } from "./campaign-values";
import { balanceParams, couponRefused, gapMarkerOk } from "./balance-input";
import type { RewardRepeat, TemplateDefinition } from "./templates";
import {
  WELCOME_STORED_DORMANT_DAYS,
  type WelcomeParams,
  welcomeDeal,
  welcomeParams,
} from "./welcome-input";

/**
 * The body of `POST /api/marketing/templates/{key}/enable` (spec 0101). PURE.
 *
 * EVERY field is optional — `{}` turns the template on with its defaults, which is the
 * whole point of a prebuilt campaign (ADR 0091: the merchant does not know how to
 * configure one). Any other key —`templateKey`, `name`, `locationIds`, a business id— is
 * IGNORED: the name is the template's title and the doors are «all the usable ones minus
 * the excluded» (ADR 0092 §5), so nothing in the body can steer either.
 *
 * `dormantDays` is validated against the TEMPLATE's options, not the database's 3..365
 * range: «Recuperar perdidos» at 45 days would be a different campaign wearing its name.
 * The coupon reuses the composer's parser (`parseCoupon`) so both surfaces refuse the
 * same half-declared coupon with the same message.
 *
 * `channels` (spec 0103 / ADR 0095): a non-empty array of `"proximity"`/`"push"` without
 * repeats, every one OFFERED by the template; absent or `null` is the template's own
 * `channels` (spec 0104) — for #3/#5 that is still BOTH, so the 0101 contract stays valid.
 *
 * BALANCE (spec 0104 / ADR 0096): a template with `couponAllowed: false` refuses any coupon
 * field; `nearRewardStamps`/`nearRewardPercent` (#7) and `rewardRepeat` (#8) are checked
 * against the template's options and default when absent — in a template that does not
 * declare them they are IGNORED like any other foreign key, and stored `null`. The
 * `{faltan}` marker is MANDATORY in #7's message and a 400 anywhere else.
 *
 * WELCOME (spec 0107): its own rules live in `welcome-input.ts` — no channel, no dormant
 * days, no doors, a MANDATORY coupon without redemption cap and `endsAt` optional even with
 * it; `welcome*` in any other template is a 400.
 */

/** The reward (`CouponDeal`) follows the composer's rules exactly (spec 0106). */
export type TemplateInput = CouponDeal &
  WelcomeParams & {
    channelProximity: boolean;
    channelPush: boolean;
    dormantDays: number;
    message: string;
    excludedLocationIds: string[];
    nearRewardStamps: number | null;
    nearRewardPercent: number | null;
    rewardRepeat: RewardRepeat | null;
    startsAt: Date;
    endsAt: Date | null;
  };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const absent = (raw: unknown) => raw === undefined || raw === null;

function dormantDays(
  errors: FieldErrors,
  raw: unknown,
  template: TemplateDefinition,
): number | undefined {
  const spec = template.dormantDays;
  if (spec === null) return WELCOME_STORED_DORMANT_DAYS;
  if (absent(raw)) return spec.default;
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    !spec.options.includes(raw)
  ) {
    errors.dormantDays = `Los días sin venir tienen que ser ${spec.options.join(", ")}.`;
    return undefined;
  }
  return raw;
}

function message(
  errors: FieldErrors,
  raw: unknown,
  template: TemplateDefinition,
): string | undefined {
  if (absent(raw)) return template.message.default;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    errors.message = "El mensaje no puede estar vacío.";
    return undefined;
  }
  const value = raw.trim();
  if (value.length > template.message.maxLength) {
    errors.message = `El mensaje no puede pasar de ${template.message.maxLength} caracteres.`;
    return undefined;
  }
  return gapMarkerOk(errors, value, template) ? value : undefined;
}

function excluded(errors: FieldErrors, raw: unknown): string[] | undefined {
  if (absent(raw)) return [];
  if (
    !Array.isArray(raw) ||
    !raw.every((id) => typeof id === "string" && UUID.test(id))
  ) {
    errors.excludedLocationIds = "Hay un local que no es válido.";
    return undefined;
  }
  return [...new Set((raw as string[]).map((id) => id.toLowerCase()))];
}

const CHANNELS = ["proximity", "push"] as const;

function channels(
  errors: FieldErrors,
  raw: unknown,
  template: TemplateDefinition,
): { channelProximity: boolean; channelPush: boolean } | undefined {
  if (absent(raw)) raw = [...template.channels];
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    new Set(raw).size !== raw.length ||
    !raw.every((value) => (CHANNELS as readonly unknown[]).includes(value))
  ) {
    errors.channels = "Elegí al menos un canal válido.";
    return undefined;
  }
  if (
    !raw.every((value) =>
      (template.channels as readonly unknown[]).includes(value),
    )
  ) {
    errors.channels = `Esta campaña solo sale por ${template.channels.join(", ")}.`;
    return undefined;
  }
  return {
    channelProximity: raw.includes("proximity"),
    channelPush: raw.includes("push"),
  };
}

function when(
  errors: FieldErrors,
  raw: unknown,
  field: string,
  label: string,
): Date | undefined {
  const value = typeof raw === "string" ? new Date(raw) : null;
  if (value === null || Number.isNaN(value.getTime())) {
    errors[field] = `${label} no es una fecha válida.`;
    return undefined;
  }
  return value;
}

export function parseTemplateInput(
  template: TemplateDefinition,
  value: unknown,
  now: Date,
): ParseResult<TemplateInput> {
  const body = asObject(value);
  const errors: FieldErrors = {};

  const welcome = template.welcome !== null;
  const lanes = welcome
    ? { channelProximity: false, channelPush: false }
    : channels(errors, body.channels, template);
  const days = welcome
    ? WELCOME_STORED_DORMANT_DAYS
    : dormantDays(errors, body.dormantDays, template);
  const text = message(errors, body.message, template);
  const doorsOut = welcome ? [] : excluded(errors, body.excludedLocationIds);
  const deal = welcome
    ? welcomeDeal(errors, body)
    : couponRefused(errors, body, template)
      ? undefined
      : parseCoupon(errors, body);
  const balance = balanceParams(errors, body, template);
  const gift = welcomeParams(errors, body, template);
  const startsAt = absent(body.startsAt)
    ? now
    : when(errors, body.startsAt, "startsAt", "La fecha de inicio");
  const endsAt = absent(body.endsAt)
    ? null
    : when(errors, body.endsAt, "endsAt", "La fecha de fin");
  if (startsAt && endsAt && endsAt <= startsAt)
    errors.endsAt = "La fecha de fin tiene que ser posterior a la de inicio.";
  // Spec 0107: the welcome coupon expires by its own days, not by the campaign's end.
  if (!welcome) requireEndForCoupon(errors, deal, endsAt);

  if (
    Object.keys(errors).length > 0 ||
    lanes === undefined ||
    days === undefined ||
    text === undefined ||
    doorsOut === undefined ||
    deal === undefined ||
    balance === undefined ||
    gift === undefined ||
    startsAt === undefined ||
    endsAt === undefined
  )
    return { ok: false, errors };

  return {
    ok: true,
    value: {
      ...lanes,
      dormantDays: days,
      message: text,
      excludedLocationIds: doorsOut,
      startsAt,
      endsAt,
      ...deal,
      ...balance,
      ...gift,
    },
  };
}
