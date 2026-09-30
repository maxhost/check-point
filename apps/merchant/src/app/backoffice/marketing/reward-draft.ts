import type { CouponKind, DiscountUnit } from "./marketing-types";
import { money, REWARD_KIND_LABELS } from "./reward-labels";

export type RewardDraft = {
  couponKind: CouponKind;
  couponLabel: string;
  couponCost: string;
  couponMaxRedemptions: number;
  couponProductId: string | null;
  couponProductName: string;
  couponDiscountUnit: DiscountUnit;
  couponDiscountValue: string;
  couponExtraUnits: number;
  couponRule: string;
  couponLabelEdited: boolean;
};

export function emptyReward(): RewardDraft {
  return {
    couponKind: "free_product",
    couponLabel: "",
    couponCost: "",
    couponMaxRedemptions: 100,
    couponProductId: null,
    couponProductName: "",
    couponDiscountUnit: "percent",
    couponDiscountValue: "",
    couponExtraUnits: 1,
    couponRule: "",
    couponLabelEdited: false,
  };
}

export function rewardFromCampaign(campaign: {
  couponKind?: CouponKind | null;
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
  couponDiscountUnit?: DiscountUnit | null;
  couponDiscountValue?: string | null;
  couponExtraUnits?: number | null;
  couponRule?: string | null;
}): RewardDraft {
  return {
    ...emptyReward(),
    couponKind: campaign.couponKind ?? "free_product",
    couponLabel: campaign.couponLabel ?? "",
    couponCost: campaign.couponCost ?? "",
    couponMaxRedemptions: campaign.couponMaxRedemptions ?? 100,
    couponProductId: campaign.couponProductId,
    couponDiscountUnit: campaign.couponDiscountUnit ?? "percent",
    couponDiscountValue: campaign.couponDiscountValue ?? "",
    couponExtraUnits: campaign.couponExtraUnits ?? 1,
    couponRule: campaign.couponRule ?? "",
    couponLabelEdited: Boolean(campaign.couponLabel),
  };
}

export function suggestedRewardLabel(
  reward: RewardDraft,
  currencyCode: string,
) {
  const name = reward.couponProductName.trim();
  let label: string;
  switch (reward.couponKind) {
    case "free_product":
      label = name ? `${name} gratis` : "Producto gratis";
      break;
    case "two_for_one":
      label = name ? `2x1 en ${name}` : "2x1 en producto";
      break;
    case "discount": {
      const amount = Number(reward.couponDiscountValue);
      const value = Number.isFinite(amount) && amount > 0;
      label =
        reward.couponDiscountUnit === "percent"
          ? value
            ? `${amount}% de descuento`
            : "Descuento en %"
          : value
            ? `${new Intl.NumberFormat("es", { style: "currency", currency: currencyCode }).format(amount)} de descuento`
            : "Descuento en dinero";
      break;
    }
    case "extra_stamps":
      label = `${reward.couponExtraUnits} ${reward.couponExtraUnits === 1 ? "sello" : "sellos"} extra`;
      break;
    case "extra_points":
      label = `${reward.couponExtraUnits} ${reward.couponExtraUnits === 1 ? "punto" : "puntos"} extra`;
      break;
    case "custom":
      label = reward.couponLabel;
      break;
  }
  return label.slice(0, 40);
}

export function rewardErrors(
  reward: RewardDraft,
  couponKinds?: CouponKind[],
  withRedemptionCap = true,
) {
  const errors: Record<string, string> = {};
  if (couponKinds && !couponKinds.includes(reward.couponKind))
    errors.couponKind = "Este tipo de premio ya no está disponible.";
  if (!reward.couponLabel.trim() || reward.couponLabel.trim().length > 40)
    errors.couponLabel = "Escribí un nombre de hasta 40 caracteres.";
  if (
    !reward.couponCost.trim() ||
    !Number.isFinite(Number(reward.couponCost)) ||
    Number(reward.couponCost) < 0
  )
    errors.couponCost = "Ingresá un costo válido.";
  if (
    withRedemptionCap &&
    (!Number.isInteger(reward.couponMaxRedemptions) ||
      reward.couponMaxRedemptions < 1 ||
      reward.couponMaxRedemptions > 1_000_000)
  )
    errors.couponMaxRedemptions = "Elegí un tope entre 1 y 1.000.000.";
  if (reward.couponRule.length > 2000)
    errors.couponRule = "La regla no puede superar los 2000 caracteres.";
  if (reward.couponKind === "discount") {
    const value = Number(reward.couponDiscountValue);
    if (
      !reward.couponDiscountValue.trim() ||
      (reward.couponDiscountUnit === "percent"
        ? !Number.isInteger(value) || value < 1 || value > 100
        : !Number.isFinite(value) || value < 0.01 || value > 9_999_999_999.99)
    )
      errors.couponDiscountValue =
        reward.couponDiscountUnit === "percent"
          ? "Elegí un porcentaje entero entre 1 y 100."
          : "Ingresá un monto mayor que cero.";
  }
  if (
    (reward.couponKind === "extra_stamps" ||
      reward.couponKind === "extra_points") &&
    (!Number.isInteger(reward.couponExtraUnits) ||
      reward.couponExtraUnits < 1 ||
      reward.couponExtraUnits > 1000)
  )
    errors.couponExtraUnits = "Elegí entre 1 y 1000 unidades.";
  return errors;
}

export function rewardBody(
  reward: RewardDraft,
  enabled: boolean,
  withRedemptionCap = true,
) {
  if (!enabled)
    return {
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
  const productKind =
    reward.couponKind === "free_product" || reward.couponKind === "two_for_one";
  return {
    couponKind: reward.couponKind,
    couponLabel: reward.couponLabel.trim(),
    couponCost: reward.couponCost.trim(),
    ...(withRedemptionCap
      ? { couponMaxRedemptions: reward.couponMaxRedemptions }
      : {}),
    couponProductId: productKind ? reward.couponProductId : null,
    couponDiscountUnit:
      reward.couponKind === "discount" ? reward.couponDiscountUnit : null,
    couponDiscountValue:
      reward.couponKind === "discount"
        ? reward.couponDiscountValue.trim()
        : null,
    couponExtraUnits:
      reward.couponKind === "extra_stamps" ||
      reward.couponKind === "extra_points"
        ? reward.couponExtraUnits
        : null,
    couponRule: reward.couponRule.trim() || null,
  };
}

export function rewardConfirmation(
  reward: RewardDraft,
  currencyCode: string,
  withRedemptionCap = true,
) {
  const details = [
    `${REWARD_KIND_LABELS[reward.couponKind]}: ${reward.couponLabel.trim()}`,
  ];
  if (reward.couponKind === "discount")
    details.push(
      reward.couponDiscountUnit === "percent"
        ? `${reward.couponDiscountValue} % de descuento`
        : `${money(reward.couponDiscountValue, currencyCode)} de descuento`,
    );
  if (
    reward.couponKind === "extra_stamps" ||
    reward.couponKind === "extra_points"
  )
    details.push(
      `${reward.couponExtraUnits} ${reward.couponKind === "extra_stamps" ? "sellos" : "puntos"} al canjear`,
    );
  if (reward.couponRule.trim()) {
    const rule = reward.couponRule.trim();
    details.push(`Regla: ${rule.slice(0, 120)}${rule.length > 120 ? "…" : ""}`);
  }
  details.push(
    `Costo estimado: ${money(reward.couponCost, currencyCode)} por canje${withRedemptionCap ? ` · tope ${reward.couponMaxRedemptions}` : ""}`,
  );
  return details.join(" · ");
}
