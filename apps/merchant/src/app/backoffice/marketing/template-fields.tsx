import {
  Alert,
  CheckboxField,
  ChoiceGroup,
  NumberField,
  TextAreaField,
  TextField,
} from "../../../ui";
import type {
  Location,
  MarketingSettings,
  TemplateView,
} from "./marketing-types";
import type { TemplateDraft } from "./template-draft";
import { CouponProductPicker } from "./coupon-product-picker";

const channelLabels = { proximity: "Proximidad", push: "Push" };
const repeatLabels = {
  once: "Una vez por ausencia",
  every_30_days: "Cada 30 días, hasta dos veces",
};

export function TemplateFields({
  template,
  draft,
  change,
  errors,
  settings,
  locations,
  canReadCatalog,
}: {
  template: TemplateView;
  draft: TemplateDraft;
  change: (patch: Partial<TemplateDraft>) => void;
  errors: Record<string, string>;
  settings: MarketingSettings;
  locations: Location[] | null;
  canReadCatalog: boolean;
}) {
  const channelOptions =
    template.channels.length === 2
      ? [
          ...template.channels.map((channel) => ({
            value: channel,
            label: channelLabels[channel],
          })),
          { value: "both", label: "Proximidad y push" },
        ]
      : template.channels.map((channel) => ({
          value: channel,
          label: channelLabels[channel],
        }));
  const selectedChannels =
    draft.channels.length === 2 ? "both" : draft.channels[0];
  return (
    <div className="grid gap-6">
      <ChoiceGroup
        label="¿Por dónde llega?"
        variant="cards"
        options={channelOptions}
        value={selectedChannels}
        errorMessage={errors.channels}
        onChange={(value) =>
          change({
            channels:
              value === "both"
                ? [...template.channels]
                : [value as "proximity" | "push"],
          })
        }
      />
      <ChoiceGroup
        label="Días sin venir"
        description="La campaña considera a quienes cumplen este mínimo de ausencia."
        options={template.dormantDays.options.map((days) => ({
          value: String(days),
          label: `${days} días`,
        }))}
        value={String(draft.dormantDays)}
        errorMessage={errors.dormantDays}
        onChange={(value) => change({ dormantDays: Number(value) })}
      />
      {template.atRisk && (
        <Alert title="¿Quién está en riesgo?">
          Clientes con al menos {template.atRisk.minVisits} visitas que llevan
          más de {template.atRisk.rhythmFactor} veces su intervalo habitual sin
          volver, además del mínimo de días elegido. Esta regla es fija.
        </Alert>
      )}
      <TextAreaField
        label="Mensaje que verá el cliente"
        value={draft.message}
        onChange={(message) => change({ message })}
        maxLength={template.message.maxLength}
        errorMessage={errors.message}
        description={`${draft.message.length}/${template.message.maxLength} caracteres.${template.message.gapMarker ? " Conservá {faltan}: se cambia por el saldo de cada cliente." : template.channels.length > 1 ? " El mismo mensaje se usa en ambos canales." : ""}`}
      />
      {template.nearReward && (
        <div className="grid gap-5 sm:grid-cols-2">
          <ChoiceGroup
            label="Si usa sellos: ¿cuántos le pueden faltar?"
            options={template.nearReward.stamps.options.map((value) => ({
              value: String(value),
              label: `${value} ${value === 1 ? "sello" : "sellos"}`,
            }))}
            value={String(draft.nearRewardStamps)}
            onChange={(value) => change({ nearRewardStamps: Number(value) })}
            errorMessage={errors.nearRewardStamps}
          />
          <ChoiceGroup
            label="Si usa puntos: faltante máximo"
            options={template.nearReward.pointsPercent.options.map((value) => ({
              value: String(value),
              label: `${value} % del premio`,
            }))}
            value={String(draft.nearRewardPercent)}
            onChange={(value) => change({ nearRewardPercent: Number(value) })}
            errorMessage={errors.nearRewardPercent}
          />
        </div>
      )}
      {template.repeat && (
        <ChoiceGroup
          label="Repetición"
          options={template.repeat.options.map((value) => ({
            value,
            label: repeatLabels[value],
          }))}
          value={draft.rewardRepeat ?? ""}
          onChange={(value) =>
            change({ rewardRepeat: value as TemplateDraft["rewardRepeat"] })
          }
          errorMessage={errors.rewardRepeat}
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          type="datetime-local"
          label="Inicio"
          value={draft.startsAt}
          onChange={(startsAt) => change({ startsAt })}
          description={`Dejá vacío para activar ahora. Hora de ${settings.timeZone}.`}
          errorMessage={errors.startsAt}
        />
        <TextField
          type="datetime-local"
          label="Fin"
          value={draft.endsAt}
          onChange={(endsAt) => change({ endsAt })}
          description={`Obligatorio si agregás un cupón. Hora de ${settings.timeZone}.`}
          errorMessage={errors.endsAt}
        />
      </div>
      {draft.channels.includes("proximity") && locations && (
        <fieldset className="grid gap-3 rounded-md border border-border p-4">
          <legend className="px-1 font-bold">Locales incluidos</legend>
          <p className="text-sm text-content-muted">
            Se usarán los locales activos con ubicación, excepto los que
            destildes.
          </p>
          {locations
            .filter((location) => location.status === "active")
            .map((location) => (
              <CheckboxField
                key={location.id}
                label={location.name}
                isSelected={!draft.excludedLocationIds.includes(location.id)}
                onChange={(checked) =>
                  change({
                    excludedLocationIds: checked
                      ? draft.excludedLocationIds.filter(
                          (id) => id !== location.id,
                        )
                      : [...draft.excludedLocationIds, location.id],
                  })
                }
              />
            ))}
          {locations.every((location) => location.status !== "active") && (
            <p>No hay locales activos.</p>
          )}
          {errors.excludedLocationIds && (
            <p className="text-sm font-semibold text-danger">
              {errors.excludedLocationIds}
            </p>
          )}
        </fieldset>
      )}
      {draft.channels.includes("proximity") && !locations && (
        <Alert title="Se usarán todos los locales disponibles">
          Tu permiso de Marketing permite activar esta campaña. No tenés acceso
          a la lista de Locales para excluir alguno.
        </Alert>
      )}
      {template.couponAllowed && (
        <div className="grid gap-5 rounded-md border border-border p-4">
          <CheckboxField
            label="Agregar cupón"
            description={`${template.couponRecommended ? "Recomendado para esta campaña. " : ""}Los cupones emitidos siguen vigentes hasta la fecha de fin aunque finalices la campaña.`}
            isSelected={draft.coupon}
            onChange={(coupon) => change({ coupon })}
          />
          {draft.coupon && (
            <div className="grid gap-5">
              <TextField
                label="Nombre del cupón"
                value={draft.couponLabel}
                onChange={(couponLabel) => change({ couponLabel })}
                maxLength={40}
                errorMessage={errors.couponLabel}
                placeholder="Ej.: Café gratis"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Costo por canje"
                  inputMode="decimal"
                  value={draft.couponCost}
                  onChange={(couponCost) => change({ couponCost })}
                  errorMessage={errors.couponCost}
                  placeholder="Ej.: 2.50"
                />
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
              </div>
              <CouponProductPicker
                canReadCatalog={canReadCatalog}
                productId={draft.couponProductId}
                onChange={(couponProductId) => change({ couponProductId })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
