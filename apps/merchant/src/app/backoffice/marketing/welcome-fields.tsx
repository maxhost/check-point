import {
  Alert,
  ChoiceGroup,
  NumberField,
  TextAreaField,
  TextField,
} from "../../../ui";
import type {
  CouponKind,
  MarketingSettings,
  TemplateView,
  WelcomeRedeemFrom,
} from "./marketing-types";
import type { TemplateDraft } from "./template-draft";
import { RewardFields } from "./reward-fields";

const redeemLabels: Record<WelcomeRedeemFrom, string> = {
  next_day: "Desde el día siguiente",
  same_visit: "En la misma visita",
};

export function WelcomeFields({
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
  const welcome = template.welcome;
  if (!welcome) return null;
  return (
    <div className="grid gap-6">
      <Alert title="Un regalo para clientes nuevos">
        Se entrega automáticamente cuando un cliente nuevo instala su pase en
        Apple o Google Wallet. Quienes ya estaban en el programa no lo reciben.
        Cada iPhone puede recibirlo una sola vez por negocio y se canjea en el
        mostrador.
      </Alert>
      <TextAreaField
        label="Titular de la oferta en la página de alta"
        value={draft.message}
        onChange={(message) => change({ message })}
        maxLength={template.message.maxLength}
        description={`${draft.message.length}/${template.message.maxLength} caracteres. Se muestra antes de añadir CheckPass al inicio.`}
        errorMessage={errors.message}
      />
      <ChoiceGroup
        label="Desde cuándo vale"
        options={welcome.redeemFrom.options.map((value) => ({
          value,
          label: redeemLabels[value],
        }))}
        value={draft.welcomeRedeemFrom ?? ""}
        onChange={(value) =>
          change({ welcomeRedeemFrom: value as WelcomeRedeemFrom })
        }
        errorMessage={errors.welcomeRedeemFrom}
      />
      <ChoiceGroup
        label="Vence a los"
        options={welcome.validDays.options.map((days) => ({
          value: String(days),
          label: `${days} días`,
        }))}
        value={String(draft.welcomeValidDays ?? "")}
        onChange={(value) => {
          const validDays = Number(value);
          const reminderDays = draft.welcomeReminderDays;
          change({
            welcomeValidDays: validDays,
            ...(reminderDays !== null && reminderDays >= validDays
              ? {
                  welcomeReminderDays:
                    welcome.reminderDays.options.find(
                      (days) => days < validDays,
                    ) ?? null,
                }
              : {}),
          });
        }}
        errorMessage={errors.welcomeValidDays}
      />
      <ChoiceGroup
        label="Avisar antes de que venza"
        description="El cliente recibe un aviso push antes de que venza su regalo."
        options={welcome.reminderDays.options.map((days) => ({
          value: String(days),
          label: `${days} ${days === 1 ? "día" : "días"} antes`,
          isDisabled:
            draft.welcomeValidDays !== null && days >= draft.welcomeValidDays,
        }))}
        value={String(draft.welcomeReminderDays ?? "")}
        onChange={(value) => change({ welcomeReminderDays: Number(value) })}
        errorMessage={errors.welcomeReminderDays}
      />
      <NumberField
        label="Tope de regalos por mes"
        value={draft.welcomeMonthlyCap ?? undefined}
        minValue={welcome.monthlyCap.min}
        maxValue={welcome.monthlyCap.max}
        clampOnBlur={false}
        description="Por negocio, no por local. Al llegar al tope, las nuevas altas dejan de ver la oferta y no reciben regalo."
        onChange={(welcomeMonthlyCap) => change({ welcomeMonthlyCap })}
        errorMessage={errors.welcomeMonthlyCap}
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
          description="Cada regalo entregado vence por separado, según su vigencia."
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
        />
      </div>
      {(errors.channels ||
        errors.dormantDays ||
        errors.excludedLocationIds ||
        errors.couponMaxRedemptions) && (
        <Alert kind="error" title="Revisá la configuración">
          {errors.channels ||
            errors.dormantDays ||
            errors.excludedLocationIds ||
            errors.couponMaxRedemptions}
        </Alert>
      )}
    </div>
  );
}
