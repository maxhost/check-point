import type { FieldErrors } from "./campaign-input";
import {
  type CouponDeal,
  parseCoupon,
} from "@mi-pasaporte/domain/server/marketing/reward-input";
import type { CrossAudience } from "@mi-pasaporte/domain/server/marketing/cross-rules";
import type { TemplateDefinition } from "@mi-pasaporte/domain/server/marketing/templates";

/**
 * THE «OFERTA CRUZADA» HALF OF `enable`'s BODY (spec 0136 / ADR 0104). PURE, called only by
 * `parseTemplateInput` (`template-input.ts`); the mirror of `welcome-input.ts`.
 *
 *  - In `cross`: no `channels` (its only surface is «Mis beneficios»), no excluded doors
 *    (an empty list is accepted), no `couponMaxRedemptions` (the brake is the monthly cap)
 *    — present → 400 on that field. The coupon is MANDATORY. `welcome*` are refused by
 *    `welcomeParams` like in any non-welcome template. `dormantDays` goes through the
 *    template's options and is always stored; it is only READ with `crossAudience =
 *    "dormant"`.
 *  - The three `cross*` are checked against the template's definition and default when
 *    absent. In ANY OTHER template, a `cross*` key present is a 400 on that field.
 */

export type CrossParams = {
  crossAudience: CrossAudience | null;
  crossValidDays: number | null;
  crossMonthlyCap: number | null;
};

export const CROSS_KEYS = [
  "crossAudience",
  "crossValidDays",
  "crossMonthlyCap",
] as const satisfies readonly (keyof CrossParams)[];

const NO_CROSS: CrossParams = {
  crossAudience: null,
  crossValidDays: null,
  crossMonthlyCap: null,
};

/** Only the three cross parameters of a wider input, ready for an insert. */
export function pickCross(input: CrossParams): CrossParams {
  const { crossAudience, crossValidDays, crossMonthlyCap } = input;
  return { crossAudience, crossValidDays, crossMonthlyCap };
}

const absent = (raw: unknown) => raw === undefined || raw === null;

/** The three parameters, or `undefined` with their errors written. */
export function crossParams(
  errors: FieldErrors,
  body: Record<string, unknown>,
  template: TemplateDefinition,
): CrossParams | undefined {
  const def = template.cross;
  if (!def) {
    const foreign = CROSS_KEYS.filter((key) => !absent(body[key]));
    for (const key of foreign)
      errors[key] = "Este campo es solo de la campaña «Oferta cruzada».";
    return foreign.length > 0 ? undefined : NO_CROSS;
  }
  const audience = absent(body.crossAudience)
    ? def.audience.default
    : body.crossAudience;
  if (!def.audience.options.includes(audience as CrossAudience))
    errors.crossAudience =
      "El público tiene que ser non_members, dormant o any.";
  const validDays = absent(body.crossValidDays)
    ? def.validDays.default
    : body.crossValidDays;
  if (!def.validDays.options.includes(validDays as number))
    errors.crossValidDays = `La vigencia (días) tiene que ser ${def.validDays.options.join(", ")}.`;
  const cap = absent(body.crossMonthlyCap)
    ? def.monthlyCap.default
    : body.crossMonthlyCap;
  if (
    typeof cap !== "number" ||
    !Number.isInteger(cap) ||
    cap < def.monthlyCap.min ||
    cap > def.monthlyCap.max
  )
    errors.crossMonthlyCap = `El tope mensual tiene que ser un entero entre ${def.monthlyCap.min} y ${def.monthlyCap.max}.`;
  if (CROSS_KEYS.some((key) => key in errors)) return undefined;
  return {
    crossAudience: audience as CrossAudience,
    crossValidDays: validDays as number,
    crossMonthlyCap: cap as number,
  };
}

/**
 * The shape rules of a `cross` body (channels, doors) — each present one is its own 400 —
 * and its MANDATORY coupon without a redemption cap. Same parser as the composer (spec
 * 0106), fed a placeholder cap that is dropped, exactly as `welcomeDeal` does.
 */
export function crossDeal(
  errors: FieldErrors,
  body: Record<string, unknown>,
): CouponDeal | undefined {
  if (!absent(body.channels))
    errors.channels =
      "La oferta cruzada no sale por un canal: aparece en «Mis beneficios».";
  if (
    !absent(body.excludedLocationIds) &&
    !(
      Array.isArray(body.excludedLocationIds) &&
      body.excludedLocationIds.length === 0
    )
  )
    errors.excludedLocationIds = "La oferta cruzada no excluye locales.";
  if (!absent(body.couponMaxRedemptions)) {
    errors.couponMaxRedemptions =
      "La oferta cruzada no lleva tope de canjes: el freno es el tope mensual.";
    return undefined;
  }
  if (absent(body.couponLabel) || absent(body.couponCost)) {
    errors.couponLabel =
      "La oferta cruzada necesita un premio: etiqueta y costo estimado.";
    return undefined;
  }
  const deal = parseCoupon(errors, { ...body, couponMaxRedemptions: 1 });
  return deal && { ...deal, couponMaxRedemptions: null };
}
