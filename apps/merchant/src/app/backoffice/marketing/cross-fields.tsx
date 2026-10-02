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
        Aparece en «Mis beneficios» a personas cerca de uno de tus locales y de
        otro rubro. No envía notificaciones. El cliente reclama el cupón antes
        de canjearlo en tu mostrador.
      </Alert>
      <ChoiceGroup
        label="¿A quién querés llegar?"
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
        label="Vigencia del cupón desde que se reclama"
        options={cross.validDays.options.map((days) => ({
          value: String(days),
          label: `${days} días`,
        }))}
        value={String(draft.crossValidDays ?? "")}
        onChange={(value) => change({ crossValidDays: Number(value) })}
        errorMessage={errors.crossValidDays}
      />
      <NumberField
        label="Tope de cupones reclamados por mes"
        value={draft.crossMonthlyCap ?? undefined}
        minValue={cross.monthlyCap.min}
        maxValue={cross.monthlyCap.max}
        clampOnBlur={false}
        description="Por negocio y mes calendario de su zona horaria. Al llegar al tope, la oferta deja de mostrarse hasta el mes siguiente."
        onChange={(crossMonthlyCap) => change({ crossMonthlyCap })}
        errorMessage={errors.crossMonthlyCap}
      />
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
          label="Fin (opcional)"
          value={draft.endsAt}
          onChange={(endsAt) => change({ endsAt })}
          description="Cada cupón reclamado vence por separado, según su vigencia."
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
          noCapLabelDescription="Se muestra en la oferta y en el cupón reclamado. Puedes editar la sugerencia."
        />
      </div>
    </div>
  );
}
