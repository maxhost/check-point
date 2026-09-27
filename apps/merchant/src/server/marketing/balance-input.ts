import type { FieldErrors } from "./campaign-input";
import type { TemplateInput } from "./template-input";
import { GAP_MARKER, type TemplateDefinition } from "./templates";

/**
 * The BALANCE half of `enable`'s body (spec 0104 §3 / ADR 0096). PURE, called only by
 * `parseTemplateInput` (`template-input.ts`) — it lives apart for the size budget.
 *
 *  - `couponAllowed: false` (#7, #8) refuses ANY of the three coupon fields.
 *  - `nearRewardStamps`/`nearRewardPercent` (#7) and `rewardRepeat` (#8): one of the
 *    template's options, its default when absent. A template that does not declare them
 *    IGNORES them (the docblock rule of `template-input.ts`) and they are stored `null`.
 *  - `{faltan}`: #7's alone, and MANDATORY there (owner, 2026-09-27).
 */

const absent = (raw: unknown) => raw === undefined || raw === null;

export function gapMarkerOk(
  errors: FieldErrors,
  value: string,
  template: TemplateDefinition,
): boolean {
  const has = value.includes(GAP_MARKER);
  if (has && !template.message.gapMarker) {
    errors.message = `El marcador ${GAP_MARKER} solo vale en «Te falta poco».`;
    return false;
  }
  if (!has && template.message.gapMarker) {
    errors.message = `El mensaje tiene que incluir ${GAP_MARKER}.`;
    return false;
  }
  return true;
}

/** One of `options`, the default when absent, `undefined` + its error otherwise. */
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

type BalanceParams = Pick<
  TemplateInput,
  "nearRewardStamps" | "nearRewardPercent" | "rewardRepeat"
>;

export function balanceParams(
  errors: FieldErrors,
  body: Record<string, unknown>,
  template: TemplateDefinition,
): BalanceParams | undefined {
  const near = template.nearReward;
  const stamps = near
    ? option(
        errors,
        body.nearRewardStamps,
        "nearRewardStamps",
        "El umbral de sellos",
        near.stamps,
      )
    : null;
  const percent = near
    ? option(
        errors,
        body.nearRewardPercent,
        "nearRewardPercent",
        "El umbral de puntos (%)",
        near.pointsPercent,
      )
    : null;
  const repeat = template.repeat
    ? option(
        errors,
        body.rewardRepeat,
        "rewardRepeat",
        "La repetición",
        template.repeat,
      )
    : null;
  if (stamps === undefined || percent === undefined || repeat === undefined)
    return undefined;
  return {
    nearRewardStamps: stamps,
    nearRewardPercent: percent,
    rewardRepeat: repeat,
  };
}

/** `true` (and the error written) when the template takes no coupon and one was sent. */
export function couponRefused(
  errors: FieldErrors,
  body: Record<string, unknown>,
  template: TemplateDefinition,
): boolean {
  if (template.couponAllowed) return false;
  const given = ["couponLabel", "couponCost", "couponMaxRedemptions"].some(
    (key) => !absent(body[key]),
  );
  if (given) errors.couponLabel = "Esta campaña no lleva cupón.";
  return given;
}
