import { asObject } from "./campaign-values";
import type { CampaignStatus } from "./campaign-transitions";

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

export type CampaignInput = {
  name: string;
  dormantDays: number;
  message: string;
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  locationIds: string[];
};

export type FieldErrors = Record<string, string>;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

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
 * The coupon, as ONE decision. Reading the three columns separately is what produces the
 * half-declared campaign the database refuses: a label with no cap reaches the counter
 * with nothing to stop it, and a cost with no label reaches the results with nothing to
 * name. `couponProductId` is informative in this phase (ADR 0002) and never required.
 */
function coupon(errors: FieldErrors, body: Record<string, unknown>) {
  const given = ["couponLabel", "couponCost", "couponMaxRedemptions"].filter(
    (key) => body[key] !== undefined && body[key] !== null,
  );
  if (given.length === 0) {
    return {
      couponLabel: null,
      couponCost: null,
      couponMaxRedemptions: null,
      couponProductId: null,
    };
  }
  if (given.length < 3) {
    errors.couponLabel =
      "El cupón va completo: etiqueta, costo estimado y tope de canjes.";
    return undefined;
  }
  const label = text(
    errors,
    body.couponLabel,
    "couponLabel",
    40,
    "La etiqueta",
  );
  const cost = Number(body.couponCost);
  if (!Number.isFinite(cost) || cost < 0) {
    errors.couponCost = "El costo estimado no puede ser negativo.";
  }
  const max = whole(
    errors,
    body.couponMaxRedemptions,
    "couponMaxRedemptions",
    1,
    1_000_000,
    "El tope de canjes",
  );
  const productId = body.couponProductId;
  if (productId !== undefined && productId !== null) {
    if (typeof productId !== "string" || !UUID.test(productId))
      errors.couponProductId = "El producto no es válido.";
  }
  if (label === undefined || max === undefined || errors.couponCost)
    return undefined;
  return {
    couponLabel: label,
    couponCost: cost.toFixed(2),
    couponMaxRedemptions: max,
    couponProductId: typeof productId === "string" ? productId : null,
  };
}

function locationIds(errors: FieldErrors, raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.locationIds = "Elegí al menos un local.";
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
  const deal = coupon(errors, body);

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
  // The coupon travels as a trio or not at all: if the PATCH names ANY of its three keys
  // it replaces the whole thing, otherwise the current one is carried over untouched.
  const touchesCoupon = [
    "couponLabel",
    "couponCost",
    "couponMaxRedemptions",
    "couponProductId",
  ].some((key) => key in body);
  if (touchesCoupon) {
    merged.couponLabel = body.couponLabel ?? null;
    merged.couponCost = body.couponCost ?? null;
    merged.couponMaxRedemptions = body.couponMaxRedemptions ?? null;
    merged.couponProductId = body.couponProductId ?? null;
  } else {
    merged.couponLabel = current.couponLabel;
    merged.couponCost = current.couponCost;
    merged.couponMaxRedemptions = current.couponMaxRedemptions;
    merged.couponProductId = current.couponProductId;
  }
  return parseCampaignInput(merged);
}
