/**
 * ISO 4217 currency support for the product catalog. One currency per business,
 * default derived from the business country at migration time and editable by the
 * owner. The country→currency map here mirrors the backfill in the catalog migration.
 */

/** ISO-3166 alpha-2 (uppercase) → ISO 4217 default currency. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  EC: "USD",
  US: "USD",
  SV: "USD",
  PA: "USD",
  AR: "ARS",
  BO: "BOB",
  BR: "BRL",
  CL: "CLP",
  CO: "COP",
  CR: "CRC",
  CU: "CUP",
  DO: "DOP",
  GT: "GTQ",
  HN: "HNL",
  MX: "MXN",
  NI: "NIO",
  PY: "PYG",
  PE: "PEN",
  UY: "UYU",
  VE: "VES",
  ES: "EUR",
  PT: "EUR",
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
  GB: "GBP",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  JP: "JPY",
  AU: "AUD",
};

/** Owner-selectable currencies (code + Spanish label), region-first then majors. */
export const SUPPORTED_CURRENCIES: { code: string; label: string }[] = [
  { code: "USD", label: "Dólar estadounidense (USD)" },
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "BOB", label: "Boliviano (BOB)" },
  { code: "BRL", label: "Real brasileño (BRL)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "CRC", label: "Colón costarricense (CRC)" },
  { code: "CUP", label: "Peso cubano (CUP)" },
  { code: "DOP", label: "Peso dominicano (DOP)" },
  { code: "GTQ", label: "Quetzal guatemalteco (GTQ)" },
  { code: "HNL", label: "Lempira hondureño (HNL)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "NIO", label: "Córdoba nicaragüense (NIO)" },
  { code: "PYG", label: "Guaraní paraguayo (PYG)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "UYU", label: "Peso uruguayo (UYU)" },
  { code: "VES", label: "Bolívar venezolano (VES)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "Libra esterlina (GBP)" },
  { code: "CAD", label: "Dólar canadiense (CAD)" },
  { code: "CHF", label: "Franco suizo (CHF)" },
  { code: "CNY", label: "Yuan chino (CNY)" },
  { code: "JPY", label: "Yen japonés (JPY)" },
  { code: "AUD", label: "Dólar australiano (AUD)" },
];

const SUPPORTED = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

/** The default ISO 4217 currency for a business country; `USD` when unmapped. */
export function currencyForCountry(countryCode?: string | null): string {
  if (!countryCode) return "USD";
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? "USD";
}

/** Whether an owner-supplied code is an offered ISO 4217 currency. */
export function isSupportedCurrency(code: unknown): code is string {
  return typeof code === "string" && SUPPORTED.has(code);
}
