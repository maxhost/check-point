import { COUPON_KIND_VALUES } from "@mi-pasaporte/db/schema/reward-checks";

/**
 * THE REWARD OF A CAMPAIGN, as ONE decision (spec 0106 / ADR 0098). PURE. Shared by the
 * composer (`campaign-input.ts`) and `enable` of a template (`template-input.ts`), so both
 * surfaces refuse the same half-declared reward with the same message.
 *
 * The coupon is ALL OR NOTHING: the trio `couponLabel` + `couponCost` +
 * `couponMaxRedemptions` declares it; with no trio, every other reward key must be absent
 * too. `couponKind` absent WITH a coupon is `free_product` — the old UI sends only the trio
 * and keeps working. Every error is a 400 `validation` on the field that is wrong; the
 * database `check`s (`schema/reward-checks.ts`) are only the backstop.
 *
 * What this layer CANNOT know — that `couponProductId` is a product OF THIS BUSINESS and
 * that `extra_*` matches the business's program — is checked by the stores against the
 * database (`reward-store.ts`).
 */

export type FieldErrors = Record<string, string>;

export const COUPON_KINDS = COUPON_KIND_VALUES;
export type CouponKind = (typeof COUPON_KINDS)[number];
export type DiscountUnit = "percent" | "amount";

export type CouponDeal = {
  couponKind: CouponKind | null;
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
  couponDiscountUnit: DiscountUnit | null;
  couponDiscountValue: string | null;
  couponExtraUnits: number | null;
  couponRule: string | null;
};

/** Every key of the reward. A `PATCH` that names ANY of them replaces the whole reward. */
export const REWARD_KEYS = [
  "couponKind",
  "couponLabel",
  "couponCost",
  "couponMaxRedemptions",
  "couponProductId",
  "couponDiscountUnit",
  "couponDiscountValue",
  "couponExtraUnits",
  "couponRule",
] as const satisfies readonly (keyof CouponDeal)[];

/** Only the reward of a wider input (e.g. `TemplateInput`), ready for an insert. */
export function pickReward(input: CouponDeal): CouponDeal {
  return Object.fromEntries(
    REWARD_KEYS.map((key) => [key, input[key]]),
  ) as CouponDeal;
}

const TRIO = ["couponLabel", "couponCost", "couponMaxRedemptions"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RULE_MAX = 2000;
/** `numeric(12, 2)`: the largest value the column holds. */
const AMOUNT_MAX = 9_999_999_999.99;

/** The message of an invalid product id — and of a product of ANOTHER business, so the
 * answer never reveals that the id exists elsewhere. */
export const INVALID_PRODUCT = "El producto no es válido.";

const absent = (raw: unknown) => raw === undefined || raw === null;

const NO_COUPON: CouponDeal = {
  couponKind: null,
  couponLabel: null,
  couponCost: null,
  couponMaxRedemptions: null,
  couponProductId: null,
  couponDiscountUnit: null,
  couponDiscountValue: null,
  couponExtraUnits: null,
  couponRule: null,
};

/** V8 of spec 0113: the free-text reward exists ONLY in «Horas valle». */
export const CUSTOM_ONLY_IN_VALLEY =
  "El premio de texto libre es solo de la campaña «Horas valle».";

function kindOf(
  errors: FieldErrors,
  raw: unknown,
  allowCustom: boolean,
): CouponKind | undefined {
  if (absent(raw)) return "free_product";
  if (!(COUPON_KINDS as readonly unknown[]).includes(raw)) {
    errors.couponKind = "El tipo de premio no es válido.";
    return undefined;
  }
  if (raw === "custom" && !allowCustom) {
    errors.couponKind = CUSTOM_ONLY_IN_VALLEY;
    return undefined;
  }
  return raw as CouponKind;
}

function productOf(
  errors: FieldErrors,
  raw: unknown,
  kind: CouponKind,
): string | null {
  if (absent(raw)) return null;
  if (kind !== "free_product" && kind !== "two_for_one")
    errors.couponProductId = "Este tipo de premio no lleva producto.";
  else if (typeof raw !== "string" || !UUID.test(raw))
    errors.couponProductId = INVALID_PRODUCT;
  else return raw;
  return null;
}

function discountOf(
  errors: FieldErrors,
  body: Record<string, unknown>,
  kind: CouponKind,
): Pick<CouponDeal, "couponDiscountUnit" | "couponDiscountValue"> {
  const none = { couponDiscountUnit: null, couponDiscountValue: null };
  const { couponDiscountUnit: unit, couponDiscountValue: raw } = body;
  if (kind !== "discount") {
    if (!absent(unit))
      errors.couponDiscountUnit = "Este tipo de premio no lleva descuento.";
    if (!absent(raw))
      errors.couponDiscountValue = "Este tipo de premio no lleva descuento.";
    return none;
  }
  if (unit !== "percent" && unit !== "amount") {
    errors.couponDiscountUnit = "Elegí si el descuento es en % o en monto.";
    return none;
  }
  const value =
    typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")
      ? Number(raw)
      : Number.NaN;
  if (
    unit === "percent" &&
    !(Number.isInteger(value) && value >= 1 && value <= 100)
  ) {
    errors.couponDiscountValue =
      "El porcentaje tiene que ser un entero entre 1 y 100.";
    return none;
  }
  if (unit === "amount" && !(value >= 0.01 && value <= AMOUNT_MAX)) {
    errors.couponDiscountValue = "El monto tiene que ser mayor que 0.";
    return none;
  }
  return { couponDiscountUnit: unit, couponDiscountValue: value.toFixed(2) };
}

function extraOf(
  errors: FieldErrors,
  raw: unknown,
  kind: CouponKind,
): number | null {
  const extra = kind === "extra_stamps" || kind === "extra_points";
  if (!extra) {
    if (!absent(raw))
      errors.couponExtraUnits = "Este tipo de premio no lleva cantidad extra.";
    return null;
  }
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    raw < 1 ||
    raw > 1000
  ) {
    errors.couponExtraUnits =
      "La cantidad extra tiene que ser un entero entre 1 y 1000.";
    return null;
  }
  return raw;
}

function ruleOf(errors: FieldErrors, raw: unknown): string | null {
  if (absent(raw)) return null;
  if (typeof raw !== "string") {
    errors.couponRule = "La regla tiene que ser un texto.";
    return null;
  }
  const value = raw.trim();
  if (value.length > RULE_MAX)
    errors.couponRule = `La regla no puede pasar de ${RULE_MAX} caracteres.`;
  return value.length === 0 ? null : value;
}

/**
 * `allowCustom` (spec 0113): only «Horas valle» passes `true`; everywhere else
 * `couponKind: "custom"` is a 400 on `couponKind` (V8). A `custom` reward is the label
 * alone — its product, discount and extra are refused like in any kind that lacks them.
 */
export function parseCoupon(
  errors: FieldErrors,
  body: Record<string, unknown>,
  allowCustom = false,
): CouponDeal | undefined {
  const given = TRIO.filter((key) => !absent(body[key]));
  if (given.length === 0) {
    if (REWARD_KEYS.some((key) => !absent(body[key]))) {
      errors.couponLabel =
        "El cupón va completo: etiqueta, costo estimado y tope de canjes.";
      return undefined;
    }
    return NO_COUPON;
  }
  if (given.length < TRIO.length) {
    errors.couponLabel =
      "El cupón va completo: etiqueta, costo estimado y tope de canjes.";
    return undefined;
  }
  const before = Object.keys(errors).length;
  const label = labelOf(errors, body.couponLabel);
  const cost = Number(body.couponCost);
  if (!Number.isFinite(cost) || cost < 0)
    errors.couponCost = "El costo estimado no puede ser negativo.";
  const max = body.couponMaxRedemptions;
  if (typeof max !== "number" || !Number.isInteger(max))
    errors.couponMaxRedemptions =
      "El tope de canjes tiene que ser un número entero.";
  else if (max < 1 || max > 1_000_000)
    errors.couponMaxRedemptions =
      "El tope de canjes tiene que estar entre 1 y 1000000.";
  const kind = kindOf(errors, body.couponKind, allowCustom);
  const deal =
    kind === undefined
      ? undefined
      : {
          couponKind: kind,
          couponProductId: productOf(errors, body.couponProductId, kind),
          ...discountOf(errors, body, kind),
          couponExtraUnits: extraOf(errors, body.couponExtraUnits, kind),
        };
  const rule = ruleOf(errors, body.couponRule);
  if (deal === undefined || Object.keys(errors).length > before)
    return undefined;
  return {
    ...deal,
    couponLabel: label as string,
    couponCost: cost.toFixed(2),
    couponMaxRedemptions: max as number,
    couponRule: rule,
  };
}

function labelOf(errors: FieldErrors, raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    errors.couponLabel = "La etiqueta no puede estar vacío.";
    return undefined;
  }
  const value = raw.trim();
  if (value.length > 40) {
    errors.couponLabel = "La etiqueta no puede pasar de 40 caracteres.";
    return undefined;
  }
  return value;
}
