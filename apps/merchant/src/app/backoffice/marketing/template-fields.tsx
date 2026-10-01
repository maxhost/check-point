import {
  Alert,
  ChoiceGroup,
  CheckboxField,
  TextAreaField,
  TextField,
} from "../../../ui";
import type {
  CouponKind,
  Location,
  MarketingSettings,
  TemplateView,
} from "./marketing-types";
import type { TemplateDraft } from "./template-draft";
import { RewardFields } from "./reward-fields";
import { suggestedRewardLabel } from "./reward-draft";
import { MarketingAudiencePreview } from "./marketing-audience-preview";
import { MarketingLocationPicker } from "./marketing-location-picker";
import { WelcomeFields } from "./welcome-fields";

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
  couponKinds,
  currencyCode,
}: {
  template: TemplateView;
  draft: TemplateDraft;
  change: (patch: Partial<TemplateDraft>) => void;
  errors: Record<string, string>;
  settings: MarketingSettings;
  locations: Location[] | null;
  canReadCatalog: boolean;
  couponKinds: CouponKind[];
  currencyCode: string;
}) {
  if (template.welcome)
    return (
      <WelcomeFields
        template={template}
        draft={draft}
        change={change}
        errors={errors}
        settings={settings}
        canReadCatalog={canReadCatalog}
        couponKinds={couponKinds}
        currencyCode={currencyCode}
      />
    );
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
      {template.dormantDays && (
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
      )}
      {draft.dormantDays !== null && (
        <MarketingAudiencePreview
          templateKey={template.key}
          channels={draft.channels}
          dormantDays={draft.dormantDays}
          locations={locations}
          excludedLocationIds={draft.excludedLocationIds}
        />
      )}
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
        description={`${draft.message.length}/${template.message.maxLength} caracteres.${template.message.gapMarker ? " Conserva {faltan}: se cambia por el saldo de cada cliente." : template.channels.length > 1 ? " El mismo mensaje se usa en ambos canales." : ""}`}
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
          description={`Deja vacío para activar ahora. Hora de ${settings.timeZone}.`}
          errorMessage={errors.startsAt}
        />
        <TextField
          type="datetime-local"
          label="Fin"
          value={draft.endsAt}
          onChange={(endsAt) => change({ endsAt })}
          description={`Obligatorio si agregas un cupón. Hora de ${settings.timeZone}.`}
          errorMessage={errors.endsAt}
        />
      </div>
      {draft.channels.includes("proximity") && (
        <MarketingLocationPicker
          locations={locations}
          selectedIds={(locations ?? [])
            .filter(
              (location) => !draft.excludedLocationIds.includes(location.id),
            )
            .map((location) => location.id)}
          onChange={(ids) =>
            change({
              excludedLocationIds: (locations ?? [])
                .filter((location) => !ids.includes(location.id))
                .map((location) => location.id),
            })
          }
          title="Locales incluidos"
          description="Se usarán los locales activos con ubicación, excepto los que destildes."
          error={errors.excludedLocationIds}
        />
      )}
      {template.couponAllowed && (
        <div className="grid gap-5 rounded-md border border-border p-4">
          <CheckboxField
            label="Agregar cupón"
            description={`${template.couponRecommended ? "Recomendado para esta campaña. " : ""}Los cupones emitidos siguen vigentes hasta la fecha de fin aunque finalices la campaña.`}
            isSelected={draft.coupon}
            onChange={(coupon) =>
              change({
                coupon,
                ...(coupon && !draft.couponLabelEdited
                  ? { couponLabel: suggestedRewardLabel(draft, currencyCode) }
                  : {}),
              })
            }
          />
          {draft.coupon && (
            <RewardFields
              draft={draft}
              change={change}
              errors={errors}
              currencyCode={currencyCode}
              canReadCatalog={canReadCatalog}
              couponKinds={couponKinds}
            />
          )}
        </div>
      )}
    </div>
  );
}
