import {
  Alert,
  ChoiceGroup,
  NumberField,
  TextAreaField,
  TextField,
} from "../../../ui";
import type {
  CouponKind,
  CrossAudience,
  MarketingSettings,
  TemplateView,
} from "./marketing-types";
import type { TemplateDraft } from "./template-draft";
import { RewardFields } from "./reward-fields";

const audienceLabels: Record<CrossAudience, string> = {
  non_members: "Personas que aún no son clientes",
  dormant: "Clientes dormidos",
  any: "Cualquiera de los dos públicos",
  not_active: "Personas que no están activas",
};

export function CrossFields({
  template,
  draft,
  change,
  errors,
  settings,
  canReadCatalog,
  couponKinds,
  currencyCode,
}: {
  template: TemplateView;
  draft: TemplateDraft;
  change: (patch: Partial<TemplateDraft>) => void;
  errors: Record<string, string>;
  settings: MarketingSettings;
  canReadCatalog: boolean;
  couponKinds: CouponKind[];
  currencyCode: string;
}) {
  const cross = template.cross;
  if (!cross) return null;
  return (
    <div className="grid gap-6">
      <Alert title="Una oferta para descubrir tu negocio">
        Tras una compra en otro comercio participante, tu campaña puede salir
        elegida para entregar un cupón. El cliente lo ve en «Mis beneficios» y,
        si activó las notificaciones, recibe un aviso de regalo.
      </Alert>
      <ChoiceGroup
        label="¿A quién quieres llegar?"
        variant="cards"
        options={cross.audience.options.map((value) => ({
          value,
          label: audienceLabels[value],
        }))}
        value={draft.crossAudience ?? ""}
        onChange={(value) => change({ crossAudience: value as CrossAudience })}
        errorMessage={errors.crossAudience}
      />
      {draft.crossAudience === "dormant" && template.dormantDays && (
        <ChoiceGroup
          label="Días sin venir"
          description="Este mínimo solo se aplica a los clientes dormidos."
          options={template.dormantDays.options.map((days) => ({
            value: String(days),
            label: `${days} días`,
          }))}
          value={String(draft.dormantDays ?? "")}
          onChange={(value) => change({ dormantDays: Number(value) })}
          errorMessage={errors.dormantDays}
        />
      )}
      <TextAreaField
        label="Mensaje de la oferta"
        value={draft.message}
        onChange={(message) => change({ message })}
        maxLength={template.message.maxLength}
        description={`${draft.message.length}/${template.message.maxLength} caracteres. Se muestra en «Mis beneficios».`}
        errorMessage={errors.message}
      />
      <ChoiceGroup
        label="Vigencia del cupón desde que se entrega"
        options={cross.validDays.options.map((days) => ({
          value: String(days),
          label: `${days} días`,
        }))}
        value={String(draft.crossValidDays ?? "")}
        onChange={(value) => change({ crossValidDays: Number(value) })}
        errorMessage={errors.crossValidDays}
      />
      <NumberField
        label="Tope de cupones entregados por mes"
        value={draft.crossMonthlyCap ?? undefined}
        minValue={cross.monthlyCap.min}
        maxValue={cross.monthlyCap.max}
        clampOnBlur={false}
        description="Por negocio y mes calendario de su zona horaria. Al llegar al tope, no se entregan más cupones hasta el mes siguiente."
        onChange={(crossMonthlyCap) => change({ crossMonthlyCap })}
        errorMessage={errors.crossMonthlyCap}
      />
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
          label="Fin de la campaña"
          isRequired
          value={draft.endsAt}
          onChange={(endsAt) => change({ endsAt })}
          description={`Obligatoria. Hora de ${settings.timeZone}. Los cupones ya entregados vencen según su propia vigencia.`}
          errorMessage={errors.endsAt}
        />
      </div>
      <div className="grid gap-5 rounded-md border border-border p-4">
        <h2 className="text-lg font-bold">Premio obligatorio</h2>
        <RewardFields
          draft={draft}
          change={change}
          errors={errors}
          currencyCode={currencyCode}
          canReadCatalog={canReadCatalog}
          couponKinds={couponKinds}
          withRedemptionCap={false}
          noCapLabelDescription="Se muestra en el cupón entregado. Puedes editar la sugerencia."
        />
      </div>
    </div>
  );
}
