import {
  Alert,
  CheckboxField,
  NumberField,
  TextAreaField,
  TextField,
} from "../../../ui";
import type { Location } from "./marketing-types";
import type { CustomDraft } from "./custom-draft";
import { MarketingPanel } from "./marketing-ui";
import { CouponProductPicker } from "./coupon-product-picker";

export type AudiencePreview = {
  quality: "observada";
  total: number;
  reachable: number;
  noLocation: number;
  optOut: number;
  cooldown: number;
  eligible: number;
  usableLocationIds: string[];
};

export function CustomFields({
  draft,
  change,
  errors,
  locations,
  preview,
  previewError,
  timeZone,
  currencyCode,
  remainingQuota,
  canReadCatalog,
}: {
  draft: CustomDraft;
  change: (patch: Partial<CustomDraft>) => void;
  errors: Record<string, string>;
  locations: Location[];
  preview: AudiencePreview | null;
  previewError: string | null;
  timeZone: string;
  currencyCode: string;
  remainingQuota?: number;
  canReadCatalog?: boolean;
}) {
  return (
    <>
      <MarketingPanel
        title="1 · Audiencia"
        description="Elegí a quién recordar tu negocio."
      >
        <div className="grid max-w-2xl gap-5">
          <TextField
            label="Nombre interno"
            value={draft.name}
            onChange={(name) => change({ name })}
            placeholder="Ej.: Clientes que faltan hace un mes"
            errorMessage={errors.name}
            maxLength={80}
          />
          <NumberField
            label="Días sin venir"
            value={draft.dormantDays}
            onChange={(dormantDays) => change({ dormantDays })}
            minValue={7}
            maxValue={365}
            clampOnBlur={false}
            errorMessage={errors.dormantDays}
            description="Entre 7 y 365 días desde la última compra."
          />
          <fieldset className="grid gap-3 rounded-md border border-border p-4">
            <legend className="px-1 font-bold">Locales</legend>
            {locations
              .filter((location) => location.status === "active")
              .map((location) => (
                <div key={location.id}>
                  <CheckboxField
                    label={location.name}
                    description={location.addressLabel}
                    isSelected={draft.locationIds.includes(location.id)}
                    onChange={(checked) =>
                      change({
                        locationIds: checked
                          ? [...draft.locationIds, location.id]
                          : draft.locationIds.filter(
                              (id) => id !== location.id,
                            ),
                      })
                    }
                  />
                  {draft.locationIds.includes(location.id) &&
                    preview &&
                    !preview.usableLocationIds.includes(location.id) && (
                      <p className="mt-1 text-sm text-warning">
                        Este local no tiene ubicación en el mapa.
                      </p>
                    )}
                </div>
              ))}
            {errors.locationIds && (
              <p className="text-sm font-semibold text-danger">
                {errors.locationIds}
              </p>
            )}
          </fieldset>
          {preview && (
            <Alert title={`Hoy son ${preview.total} personas`}>
              {preview.reachable} alcanzables por Wallet · {preview.noLocation}{" "}
              sin local atribuible · {preview.cooldown} en cooldown ·{" "}
              {preview.eligible} elegibles ahora.
            </Alert>
          )}
          {previewError && (
            <Alert kind="warning" title="No pudimos consultar la audiencia">
              {previewError}
            </Alert>
          )}
        </div>
      </MarketingPanel>
      <MarketingPanel
        title="2 · Canal"
        description="Las campañas a medida usan proximidad en el pase."
      >
        <Alert title="Proximidad">
          El mensaje aparece cuando una persona elegible pasa cerca de un local
          incluido.
        </Alert>
      </MarketingPanel>
      <MarketingPanel
        title="3 · Mensaje"
        description="Un mensaje corto, listo para verse en el pase."
      >
        <div className="max-w-2xl">
          <TextAreaField
            label="Mensaje"
            value={draft.message}
            onChange={(message) => change({ message })}
            maxLength={60}
            errorMessage={errors.message}
            description={`${draft.message.length}/60 caracteres.`}
          />
        </div>
      </MarketingPanel>
      <MarketingPanel
        title="4 · Beneficio"
        description="Podés agregar un cupón para canjear en el mostrador."
      >
        <div className="grid max-w-2xl gap-5">
          <CheckboxField
            label="Agregar cupón"
            description="Los cupones emitidos seguirán válidos hasta el fin de la campaña aunque la finalices antes."
            isSelected={draft.coupon}
            onChange={(coupon) => change({ coupon })}
          />
          {draft.coupon && (
            <>
              <TextField
                label="Nombre del cupón"
                value={draft.couponLabel}
                onChange={(couponLabel) => change({ couponLabel })}
                errorMessage={errors.couponLabel}
                maxLength={40}
                placeholder="Ej.: Café gratis"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label={`Costo por canje (${currencyCode})`}
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
                canReadCatalog={Boolean(canReadCatalog)}
                productId={draft.couponProductId}
                onChange={(couponProductId) => change({ couponProductId })}
              />
            </>
          )}
        </div>
      </MarketingPanel>
      <MarketingPanel
        title="5 · Límites y revisión"
        description="Elegí el inicio y, si corresponde, el final de la campaña."
      >
        <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <TextField
            type="datetime-local"
            label="Inicio"
            value={draft.startsAt}
            onChange={(startsAt) => change({ startsAt })}
            description={`Hora de ${timeZone}.`}
            errorMessage={errors.startsAt}
          />
          <TextField
            type="datetime-local"
            label="Fin"
            value={draft.endsAt}
            onChange={(endsAt) => change({ endsAt })}
            description="Obligatorio si hay cupón."
            errorMessage={errors.endsAt}
          />
        </div>
        <div className="mt-5 grid gap-2 text-sm">
          {remainingQuota !== undefined && preview && (
            <>
              <p>
                Turnos que va a ocupar:{" "}
                <strong>{Math.min(preview.reachable, remainingQuota)}</strong>
              </p>
              <p>te quedan {remainingQuota} de 50 turnos simultáneos</p>
              <p>Un 10 % al azar no lo va a ver: sirve para medir el efecto.</p>
            </>
          )}
          <p>
            {draft.coupon
              ? `Costo máximo configurado: ${currencyCode} ${(Number(draft.couponCost) * draft.couponMaxRedemptions).toFixed(2)}`
              : "sin cupón, sin costo"}
          </p>
        </div>
      </MarketingPanel>
    </>
  );
}
