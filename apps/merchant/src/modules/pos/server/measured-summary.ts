import { sql, type SQLWrapper } from "drizzle-orm";
import {
  CONVERSION_VERSION,
  MASS_UNITS,
  gramsFactor,
  normalizedGross,
  assertMoneyRange,
  MeasureError,
} from "@mi-pasaporte/domain/measures";
import {
  divide,
  rational,
  formatMinor,
} from "@mi-pasaporte/domain/financial/rational";
import { PosError } from "./errors";

const SCALE = 10n ** 9n;
const gcd = (a: bigint, b: bigint): bigint => (b ? gcd(b, a % b) : a);
const ratios = [
  {
    kind: "unit",
    quantityUnit: "unit",
    priceUnit: "unit",
    ratio: rational(1n),
  },
  ...MASS_UNITS.flatMap((quantityUnit) =>
    MASS_UNITS.map((priceUnit) => ({
      kind: "mass",
      quantityUnit,
      priceUnit,
      ratio: divide(gramsFactor(quantityUnit), gramsFactor(priceUnit)),
    })),
  ),
];
const ratioDenominator = ratios.reduce(
  (d, { ratio }) => (d / gcd(d, ratio.d)) * ratio.d,
  1n,
);
/** Cents denominator. All factors come from the domain conversion version. */
export const SUMMARY_DENOMINATOR = ratioDenominator * SCALE * SCALE;

export type SummarySource = Record<
  | "quantity"
  | "price"
  | "kind"
  | "quantityUnit"
  | "priceUnit"
  | "conversionVersion",
  SQLWrapper
>;

/** SQL projects exact originals, never normalized monetary line totals. Also used on VALUES
 * in CI: mass activation barriers in canonical tables remain intact. No NUMERIC division. */
export function measuredSummaryColumns(s: SummarySource) {
  const coefficient = sql`case ${sql.join(
    ratios.map(
      (r) => sql`
    when ${s.kind} = ${r.kind} and ${s.quantityUnit} = ${r.quantityUnit}
      and ${s.priceUnit} = ${r.priceUnit}
      then ${String(r.ratio.n * (ratioDenominator / r.ratio.d))}::numeric
  `,
    ),
    sql` `,
  )} else null end`;
  const unit = sql`${s.kind} = 'unit' and ${s.quantityUnit} = 'unit' and ${s.priceUnit} = 'unit'`;
  const validUnit = sql`(${unit} and ${s.quantity} = trunc(${s.quantity})
    and ${s.quantity} <= 2147483647
    and (${s.price} <= 999999999.999999999
      or (${s.price} <= 9999999999.99 and ${s.price} * 100 = trunc(${s.price} * 100))))`;
  const validMass = sql`(${s.kind} = 'mass' and ${coefficient} is not null
    and ${s.quantity} <= 999999999.999999999 and ${s.price} <= 999999999.999999999)`;
  const valid = sql`(${s.conversionVersion} = ${CONVERSION_VERSION}
    and ${s.quantity} > 0 and ${s.price} >= 0
    and ${s.quantity} * ${String(SCALE)}::numeric = trunc(${s.quantity} * ${String(SCALE)}::numeric)
    and ${s.price} * ${String(SCALE)}::numeric = trunc(${s.price} * ${String(SCALE)}::numeric)
    and (${validUnit} or ${validMass}))`;
  const numerator = sql`(${s.quantity} * ${String(SCALE)}::numeric)
    * (${s.price} * ${String(SCALE)}::numeric) * 100 * (${coefficient})`;
  return {
    lineCount: sql<string>`count(*)::text`.as("line_count"),
    numerator: sql<string>`coalesce(sum(${numerator}), 0)::text`.as(
      "numerator",
    ),
    maxNumerator: sql<string>`coalesce(max(${numerator}), 0)::text`.as(
      "max_numerator",
    ),
    invalid: sql<boolean>`bool_or(not coalesce(${valid}, false))`.as("invalid"),
    incompatible:
      sql<boolean>`bool_or(not coalesce((${validUnit} and ${s.conversionVersion} = ${CONVERSION_VERSION}
      and ${s.price} * 100 = trunc(${s.price} * 100)), false))`.as(
        "incompatible",
      ),
    unitCount:
      sql<string>`coalesce(sum(case when ${unit} then ${s.quantity} else 0 end), 0)::text`.as(
        "unit_count",
      ),
  };
}

export type MeasuredSummary = {
  lineCount: string;
  numerator: string;
  maxNumerator: string;
  invalid: boolean;
  incompatible: boolean;
  unitCount: string;
};
export const EMPTY_SUMMARY: MeasuredSummary = {
  lineCount: "0",
  numerator: "0",
  maxNumerator: "0",
  invalid: false,
  incompatible: false,
  unitCount: "0",
};
export function upgradeRequired(): never {
  throw new PosError(
    409,
    "pos_client_upgrade_required",
    "Actualiza la aplicación para leer esta venta.",
  );
}
function integer(value: string): bigint {
  // NUMERIC products retain their scale; only redundant zeroes may be removed.
  if (!/^\d+(?:\.0+)?$/.test(value)) return upgradeRequired();
  return BigInt(value.split(".")[0]);
}
function projectAmounts(
  summary: MeasuredSummary,
  currencyCode: string,
  version: 1 | 2,
) {
  if (summary.invalid || (version === 1 && summary.incompatible))
    upgradeRequired();
  const gross = rational(integer(summary.numerator), SUMMARY_DENOMINATOR);
  assertMoneyRange(
    rational(integer(summary.maxNumerator), SUMMARY_DENOMINATOR),
  );
  assertMoneyRange(gross);
  const count = integer(summary.lineCount);
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) upgradeRequired();
  if (version === 2)
    return {
      total: normalizedGross(gross, currencyCode),
      lineCount: Number(count),
      itemCount: 0,
    };
  const units = integer(summary.unitCount);
  // Check metadata and exact representability BEFORE converting the count to Number.
  if (units > BigInt(Number.MAX_SAFE_INTEGER) || gross.n % gross.d !== 0n)
    upgradeRequired();
  return {
    total: formatMinor(gross.n / gross.d, 2),
    lineCount: Number(count),
    itemCount: Number(units),
  };
}

/** Keep existing POS monetary failures serializable through the V1 caller too. */
export function summaryAmounts(
  summary: MeasuredSummary,
  currencyCode: string,
  version: 1 | 2,
) {
  try {
    return projectAmounts(summary, currencyCode, version);
  } catch (error) {
    if (error instanceof MeasureError && error.code === "amount_out_of_range")
      throw new PosError(
        422,
        "invalid_amount",
        "El total es demasiado grande.",
      );
    throw error;
  }
}
