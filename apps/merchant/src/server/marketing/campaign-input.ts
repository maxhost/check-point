import { asObject } from "./campaign-values";
import type { CampaignStatus } from "./campaign-transitions";
import {
  type CouponDeal,
  type FieldErrors,
  REWARD_KEYS,
  parseCoupon,
} from "@mi-pasaporte/domain/server/marketing/reward-input";

/**
 * The composer's body, validated field by field (spec 0065: «400 `validation` por
 * campo»). The database already refuses everything invalid — `name` 1..80, `message`
 * 1..60, `dormant_days` 7..365 and the ALL-OR-NOTHING coupon are `check`s of the
 * migration `0031` — so this layer is NOT what protects the data. It exists so the owner
 * gets a message next to the field that is wrong instead of a 503 from a constraint
 * whose name means nothing to them.
 *
 * `partial` is the `PATCH`: only the keys present are validated, and the coupon is still
 * checked as a TRIO, because sending only `couponCost` over a campaign that has no coupon
 * would build exactly the half-declared state the check forbids.
 */

/** The reward (`CouponDeal`) is validated by `reward-input.ts` (spec 0106). */
export type CampaignInput = CouponDeal & {
  name: string;
  dormantDays: number;
  message: string;
  startsAt: Date;
  endsAt: Date | null;
  locationIds: string[];
};

export type { FieldErrors };

export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; errors: FieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(
  errors: FieldErrors,
  raw: unknown,
  field: string,
  max: number,
  label: string,
): string | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    errors[field] = `${label} no puede estar vacío.`;
    return undefined;
  }
  const value = raw.trim();
  if (value.length > max) {
    errors[field] = `${label} no puede pasar de ${max} caracteres.`;
    return undefined;
  }
  return value;
}

function whole(
  errors: FieldErrors,
  raw: unknown,
  field: string,
  min: number,
  max: number,
  label: string,
): number | undefined {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    errors[field] = `${label} tiene que ser un número entero.`;
    return undefined;
  }
  if (raw < min || raw > max) {
    errors[field] = `${label} tiene que estar entre ${min} y ${max}.`;
    return undefined;
  }
  return raw;
}

function when(
  errors: FieldErrors,
  raw: unknown,
  field: string,
  label: string,
): Date | undefined {
  if (typeof raw !== "string") {
    errors[field] = `${label} tiene que ser una fecha.`;
    return undefined;
  }
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    errors[field] = `${label} no es una fecha válida.`;
    return undefined;
  }
  return value;
}

/**
 * ADR 0094 §3: an issued coupon is valid until the campaign's `ends_at`, so a campaign
 * with a coupon MUST have one. The `CHECK core_campaign_coupon_needs_end_check` is the
 * backstop; this is what turns it into a 400 `validation` on the `endsAt` field instead of
 * a 503. `deal`/`endsAt` are `undefined` when their own parse already failed — then there
 * is nothing to add. Called by `parseCampaignInput` (create and `PATCH`) and by
 * `parseTemplateInput` (`enable`): two call sites, two wirings.
 */
export function requireEndForCoupon(
  errors: FieldErrors,
  deal: { couponLabel: string | null } | undefined,
  endsAt: Date | null | undefined,
): void {
  if (deal !== undefined && deal.couponLabel !== null && endsAt === null)
    errors.endsAt = "Una campaña con cupón necesita fecha de fin.";
}

function locationIds(errors: FieldErrors, raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.locationIds = "Elige al menos un local.";
    return undefined;
  }
  if (!raw.every((id) => typeof id === "string" && UUID.test(id))) {
    errors.locationIds = "Hay un local que no es válido.";
    return undefined;
  }
  return [...new Set(raw as string[])];
}

export function parseCampaignInput(value: unknown): ParseResult<CampaignInput> {
  const body = asObject(value);
  const errors: FieldErrors = {};

  const name = text(errors, body.name, "name", 80, "El nombre");
  const message = text(errors, body.message, "message", 60, "El mensaje");
  const dormantDays = whole(
    errors,
    body.dormantDays ?? 30,
    "dormantDays",
    7,
    365,
    "Los días sin venir",
  );
  const startsAt = when(
    errors,
    body.startsAt,
    "startsAt",
    "La fecha de inicio",
  );
  const endsAt =
    body.endsAt === undefined || body.endsAt === null
      ? null
      : when(errors, body.endsAt, "endsAt", "La fecha de fin");
  if (startsAt && endsAt && endsAt <= startsAt)
    errors.endsAt = "La fecha de fin tiene que ser posterior a la de inicio.";
  const doors = locationIds(errors, body.locationIds);
  const deal = parseCoupon(errors, body);
  requireEndForCoupon(errors, deal, endsAt);

  if (
    Object.keys(errors).length > 0 ||
    name === undefined ||
    message === undefined ||
    dormantDays === undefined ||
    startsAt === undefined ||
    endsAt === undefined ||
    doors === undefined ||
    deal === undefined
  )
    return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      message,
      dormantDays,
      startsAt,
      endsAt,
      locationIds: doors,
      ...deal,
    },
  };
}

/** The `PATCH`: same rules, but only over the keys the owner actually sent. */
export function parseCampaignPatch(
  value: unknown,
  current: CampaignInput & { status: CampaignStatus },
): ParseResult<CampaignInput> {
  const body = asObject(value);
  const merged: Record<string, unknown> = {
    name: body.name ?? current.name,
    message: body.message ?? current.message,
    dormantDays: body.dormantDays ?? current.dormantDays,
    startsAt: body.startsAt ?? current.startsAt.toISOString(),
    endsAt:
      "endsAt" in body ? body.endsAt : (current.endsAt?.toISOString() ?? null),
    locationIds: body.locationIds ?? current.locationIds,
  };
  // The reward travels whole or not at all (spec 0106): if the PATCH names ANY of its keys
  // it replaces the whole thing —the absent ones become `null`—, otherwise the current one
  // is carried over untouched.
  const touchesCoupon = REWARD_KEYS.some((key) => key in body);
  for (const key of REWARD_KEYS)
    merged[key] = touchesCoupon ? (body[key] ?? null) : (current[key] ?? null);
  return parseCampaignInput(merged);
}
