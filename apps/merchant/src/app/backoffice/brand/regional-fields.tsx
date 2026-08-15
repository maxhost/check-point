"use client";

import { SUPPORTED_CURRENCIES } from "../../../lib/currencies";

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
  return (
    <section className="timezone-settings" aria-labelledby="regional-title">
      <h2 id="regional-title" className="color-heading">
        Zona horaria y moneda
      </h2>
      <label>
        Zona horaria del negocio
        <select
          value={timezone}
          onChange={(event) => onTimezoneChange(event.target.value)}
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">
        Las fechas y horarios de tus programas y campañas se interpretan en esta
        zona.
      </p>
      <label>
        Moneda
        <select
          value={currencyCode}
          onChange={(event) => onCurrencyChange(event.target.value)}
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.label}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">
        Se usa para mostrar los precios de tu catálogo. Se derivó del país al
        crear el negocio; puedes cambiarla.
      </p>
    </section>
  );
}
