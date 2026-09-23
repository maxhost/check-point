"use client";

import { SUPPORTED_CURRENCIES } from "../../../lib/currencies";
import { SelectField } from "../../../ui";

const timezones = [
  "America/Argentina/Buenos_Aires",
  "America/Asuncion",
  "America/Bogota",
  "America/Guayaquil",
  "America/Lima",
  "America/Mexico_City",
  "America/Montevideo",
  "America/Santiago",
  "America/Sao_Paulo",
];

type Props = {
  timezone: string;
  currencyCode: string;
  onTimezoneChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
};

/** Regional settings for the business: timezone and the ISO 4217 price currency. */
export function RegionalFields({
  timezone,
  currencyCode,
  onTimezoneChange,
  onCurrencyChange,
}: Props) {
  const timezoneOptions = [
    ...(!timezones.includes(timezone) ? [timezone] : []),
    ...timezones,
  ].map((zone) => ({ id: zone, label: zone.replaceAll("_", " ") }));

  return (
    <div className="brand-regional-grid">
      <SelectField
        label="Zona horaria del negocio"
        description="Define las fechas y horarios de programas y campañas."
        options={timezoneOptions}
        selectedKey={timezone}
        onSelectionChange={(key) => onTimezoneChange(String(key))}
      />
      <SelectField
        label="Moneda"
        description="Se usa para mostrar los precios de tu catálogo."
        options={SUPPORTED_CURRENCIES.map((currency) => ({
          id: currency.code,
          label: currency.label,
        }))}
        selectedKey={currencyCode}
        onSelectionChange={(key) => onCurrencyChange(String(key))}
      />
    </div>
  );
}
