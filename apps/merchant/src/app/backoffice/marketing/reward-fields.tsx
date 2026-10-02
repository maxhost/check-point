"use client";
import {
  ChoiceGroup,
  NumberField,
  TextAreaField,
  TextField,
} from "../../../ui";
import type { CouponKind, DiscountUnit } from "./marketing-types";
import type { RewardDraft } from "./reward-draft";
import { suggestedRewardLabel } from "./reward-draft";
import { CouponProductPicker } from "./coupon-product-picker";
import { REWARD_KIND_LABELS } from "./reward-labels";

export function RewardFields({
  draft,
  change,
  errors,
  currencyCode,
  canReadCatalog,
  couponKinds,
  withRedemptionCap = true,
  noCapLabelDescription = "Se muestra en la oferta de alta y en el regalo. Puedes editar la sugerencia.",
}: {
  draft: RewardDraft;
  change: (patch: Partial<RewardDraft>) => void;
  errors: Record<string, string>;
  currencyCode: string;
  canReadCatalog: boolean;
  couponKinds: CouponKind[];
  withRedemptionCap?: boolean;
  noCapLabelDescription?: string;
}) {
  const options = couponKinds.map((kind) => ({
    value: kind,
    label: REWARD_KIND_LABELS[kind],
  }));
  const selectedAvailable = couponKinds.includes(draft.couponKind);

  function update(patch: Partial<RewardDraft>) {
    const next = {
      ...draft,
      ...patch,
      ...(patch.couponKind ? { couponLabelEdited: false } : {}),
    };
    change({
      ...patch,
      ...(patch.couponKind ? { couponLabelEdited: false } : {}),
      ...(!next.couponLabelEdited
        ? { couponLabel: suggestedRewardLabel(next, currencyCode) }
        : {}),
    });
  }
  const productKind =
    draft.couponKind === "free_product" || draft.couponKind === "two_for_one";
  const currencySymbol =
    new Intl.NumberFormat("es", { style: "currency", currency: currencyCode })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currencyCode;
  return (
    <div className="grid gap-5">
      <ChoiceGroup
        label="Tipo de premio"
        variant="cards"
        options={options}
        value={selectedAvailable ? draft.couponKind : ""}
        onChange={(value) => update({ couponKind: value as CouponKind })}
        errorMessage={
          errors.couponKind ||
          (!selectedAvailable
            ? "Este tipo de premio ya no está disponible. Elige otro."
            : undefined)
        }
      />
      {productKind && (
        <CouponProductPicker
          canReadCatalog={canReadCatalog}
          productId={draft.couponProductId}
          errorMessage={errors.couponProductId}
          onChange={(couponProductId) => update({ couponProductId })}
          onProductSelected={(product) =>
            update({
              couponProductName: product?.name ?? "",
              ...(product?.unitCost !== null &&
              product?.unitCost !== undefined &&
              !draft.couponCost.trim()
                ? { couponCost: product.unitCost.toFixed(2) }
                : {}),
            })
          }
        />
      )}
      {draft.couponKind === "discount" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <ChoiceGroup
            label="Tipo de descuento"
            options={[
              { value: "percent", label: "Porcentaje" },
              { value: "amount", label: `Monto (${currencySymbol})` },
            ]}
            value={draft.couponDiscountUnit}
            onChange={(value) =>
              update({ couponDiscountUnit: value as DiscountUnit })
            }
            errorMessage={errors.couponDiscountUnit}
          />
          <TextField
            label={
              draft.couponDiscountUnit === "percent"
                ? "Porcentaje de descuento"
                : `Monto de descuento (${currencySymbol})`
            }
            inputMode="decimal"
            value={draft.couponDiscountValue}
            onChange={(couponDiscountValue) => update({ couponDiscountValue })}
            errorMessage={errors.couponDiscountValue}
          />
        </div>
      )}
      {(draft.couponKind === "extra_stamps" ||
        draft.couponKind === "extra_points") && (
        <NumberField
          label={
            draft.couponKind === "extra_stamps"
              ? "Sellos que se acreditan al canjear"
              : "Puntos que se acreditan al canjear"
          }
          value={draft.couponExtraUnits}
          minValue={1}
          maxValue={1000}
          clampOnBlur={false}
          description="Se acredita en el mostrador al canjear y no cuenta como visita."
          onChange={(couponExtraUnits) => update({ couponExtraUnits })}
          errorMessage={errors.couponExtraUnits}
        />
      )}
      <TextField
        label="Texto visible del cupón"
        value={draft.couponLabel}
        onChange={(couponLabel) =>
          change({ couponLabel, couponLabelEdited: true })
        }
        maxLength={40}
        description={
          withRedemptionCap
            ? "Lo verá el cliente y puede aparecer en el push. Puedes editar la sugerencia."
            : noCapLabelDescription
        }
        errorMessage={errors.couponLabel}
      />
      <TextAreaField
        label="Condiciones del cupón (opcional)"
        value={draft.couponRule}
        onChange={(couponRule) => change({ couponRule })}
        description="El cliente y el cajero verán esta regla al consultar el cupón."
        errorMessage={errors.couponRule}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={`Costo estimado por canje (${currencySymbol})`}
          inputMode="decimal"
          value={draft.couponCost}
          onChange={(couponCost) => change({ couponCost })}
          errorMessage={errors.couponCost}
          placeholder="Ej.: 2.50"
        />
        {withRedemptionCap && (
          <NumberField
            label="Tope de canjes"
            value={draft.couponMaxRedemptions}
            minValue={1}
            maxValue={1_000_000}
            clampOnBlur={false}
            onChange={(couponMaxRedemptions) =>
              change({ couponMaxRedemptions })
            }
            errorMessage={errors.couponMaxRedemptions}
          />
        )}
      </div>
    </div>
  );
}
