import {
  type FieldErrors,
  type ParseResult,
  parseCoupon,
  requireEndForCoupon,
} from "./campaign-input";
import { asObject } from "./campaign-values";
import type { TemplateDefinition } from "./templates";

/**
 * The body of `POST /api/marketing/templates/{key}/enable` (spec 0101). PURE.
 *
 * EVERY field is optional — `{}` turns the template on with its defaults, which is the
 * whole point of a prebuilt campaign (ADR 0091: the merchant does not know how to
 * configure one). Any other key —`templateKey`, `name`, `locationIds`, a business id— is
 * IGNORED: the name is the template's title and the doors are «all the usable ones minus
 * the excluded» (ADR 0092 §5), so nothing in the body can steer either.
 *
 * `dormantDays` is validated against the TEMPLATE's options, not the database's 7..365
 * range: «Recuperar perdidos» at 45 days would be a different campaign wearing its name.
 * The coupon reuses the composer's parser (`parseCoupon`) so both surfaces refuse the
 * same half-declared coupon with the same message.
 *
 * `channels` (spec 0103 / ADR 0095): a non-empty array of `"proximity"`/`"push"` without
 * repeats; absent or `null` is BOTH (owner's decision: the 0101 contract stays valid).
 */

export type TemplateInput = {
  channelProximity: boolean;
  channelPush: boolean;
  dormantDays: number;
  message: string;
  excludedLocationIds: string[];
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
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
  if (absent(raw)) return template.dormantDays.default;
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    !template.dormantDays.options.includes(raw)
  ) {
    errors.dormantDays = `Los días sin venir tienen que ser ${template.dormantDays.options.join(", ")}.`;
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
  return value;
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
): { channelProximity: boolean; channelPush: boolean } | undefined {
  if (absent(raw)) return { channelProximity: true, channelPush: true };
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    new Set(raw).size !== raw.length ||
    !raw.every((value) => (CHANNELS as readonly unknown[]).includes(value))
  ) {
    errors.channels = "Elegí al menos un canal válido.";
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

  const lanes = channels(errors, body.channels);
  const days = dormantDays(errors, body.dormantDays, template);
  const text = message(errors, body.message, template);
  const doorsOut = excluded(errors, body.excludedLocationIds);
  const deal = parseCoupon(errors, body);
  const startsAt = absent(body.startsAt)
    ? now
    : when(errors, body.startsAt, "startsAt", "La fecha de inicio");
  const endsAt = absent(body.endsAt)
    ? null
    : when(errors, body.endsAt, "endsAt", "La fecha de fin");
  if (startsAt && endsAt && endsAt <= startsAt)
    errors.endsAt = "La fecha de fin tiene que ser posterior a la de inicio.";
  requireEndForCoupon(errors, deal, endsAt);

  if (
    Object.keys(errors).length > 0 ||
    lanes === undefined ||
    days === undefined ||
    text === undefined ||
    doorsOut === undefined ||
    deal === undefined ||
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
    },
  };
}
