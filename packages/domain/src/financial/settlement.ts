import {
  FinancialError,
  type FinancialInput,
  type FinancialInputV2,
  type FinancialAmounts,
  type FinancialSettlement,
  type PaymentInput,
} from "./types";
import {
  fromExact,
  add,
  subtract,
  multiply,
  divide,
  rational,
  exact,
  originalMoney,
  minorUnitForCurrency,
  toMinor,
  formatMinor,
  minorRational,
  allocateCumulative,
} from "./rational";
import { assertMoneyRange, exactLineGross } from "../measures/mass";
import { exactSnapshotLineGross } from "../measures/legacy";
import { MeasureError } from "../measures/types";

type AmountInput = FinancialInput | FinancialInputV2;
type SettlementInput = AmountInput & { payments: readonly PaymentInput[] };

export function buildFinancialAmounts(input: AmountInput): FinancialAmounts {
  return buildAmounts(input, false);
}
/** Trusted persisted snapshots only; never select this path from input shape. */
export function buildFinancialAmountsFromSnapshots(
  input: FinancialInputV2,
): FinancialAmounts {
  return buildAmounts(input, true);
}
/** Resolve the internal union before the existing normalization/allocation path. */
function discountOriginal(input: AmountInput) {
  const discount = input.discount;
  if (!discount) return rational(0n);
  const decimal = "amount" in discount;
  const original = "originalAmount" in discount;
  if (decimal === original) throw new FinancialError("invalid_financial_input");
  if (decimal) return originalMoney(discount.amount!);
  if (input.lines.some((line) => !("measure" in line)))
    throw new FinancialError("invalid_financial_input");
  const origin = discount.origin;
  if (
    !origin ||
    typeof origin !== "object" ||
    Array.isArray(origin) ||
    typeof origin.sourceId !== "string" ||
    !origin.sourceId ||
    (origin.campaignId !== undefined &&
      (typeof origin.campaignId !== "string" || !origin.campaignId)) ||
    (origin.benefitKind !== undefined &&
      (typeof origin.benefitKind !== "string" || !origin.benefitKind)) ||
    (origin.scope === "order" && origin.targetSourceLineId !== undefined)
  )
    throw new FinancialError("invalid_financial_input");
  const value = discount.originalAmount;
  if (
    !value ||
    typeof value !== "object" ||
    value.scale !== 2 ||
    typeof value.numerator !== "string" ||
    typeof value.denominator !== "string" ||
    !/^(0|[1-9]\d*)$/.test(value.numerator) ||
    !/^[1-9]\d*$/.test(value.denominator)
  )
    throw new FinancialError("invalid_financial_input");
  const parsed = fromExact(value);
  const canonical = exact(parsed);
  if (
    canonical.numerator !== value.numerator ||
    canonical.denominator !== value.denominator
  )
    throw new FinancialError("invalid_financial_input");
  return parsed;
}
function buildAmounts(
  input: AmountInput,
  snapshots: boolean,
): FinancialAmounts {
  const minorUnit = minorUnitForCurrency(input.currencyCode);
  const lines = [...input.lines].sort(
    (a, b) =>
      a.position - b.position || a.sourceLineId.localeCompare(b.sourceLineId),
  );
  if (
    !lines.length ||
    new Set(lines.map((l) => l.sourceLineId)).size !== lines.length ||
    lines.some(
      (l) =>
        !l.sourceLineId || !Number.isSafeInteger(l.position) || l.position < 0,
    )
  )
    throw new FinancialError("invalid_financial_input");
  const gross = lines.map((line) => {
      if (snapshots || "measure" in line) {
        if (typeof line.quantity !== "string")
          throw new MeasureError("invalid_quantity", "quantity");
        return fromExact(
          (snapshots ? exactSnapshotLineGross : exactLineGross)(
            line.quantity,
            line.unitPrice,
            "measure" in line ? line.measure : undefined,
          ),
        );
      }
      if (!Number.isSafeInteger(line.quantity) || line.quantity < 1)
        throw new FinancialError("invalid_financial_input");
      return multiply(
        originalMoney(line.unitPrice),
        rational(BigInt(line.quantity)),
      );
    }),
    g0 = gross.reduce(add, rational(0n)),
    d0 = discountOriginal(input),
    n0 = subtract(g0, d0);
  for (const amount of [...gross, g0, d0]) assertMoneyRange(amount);
  // The stored total must fit after currency normalization as well.
  for (const amount of [g0, d0]) assertMoneyRange(amount, input.currencyCode);
  if (n0.n < 0n) throw new FinancialError("invalid_financial_input");
  assertMoneyRange(n0, input.currencyCode);
  const origin = input.discount?.origin ?? null;
  const target =
    origin?.scope === "line"
      ? lines.findIndex((l) => l.sourceLineId === origin.targetSourceLineId)
      : -1;
  if (
    origin &&
    (!origin.sourceId ||
      !["order", "line"].includes(origin.scope) ||
      !["campaign_coupon", "program_reward"].includes(origin.type) ||
      (origin.scope === "line" &&
        (target < 0 || subtract(gross[target], d0).n < 0n)))
  )
    throw new FinancialError("invalid_financial_input");
  const originalDiscount = gross.map((g, i) =>
    origin?.scope === "line"
      ? i === target
        ? d0
        : rational(0n)
      : g0.n === 0n
        ? rational(0n)
        : multiply(d0, divide(g, g0)),
  );
  const remaining = gross.map((g, i) => subtract(g, originalDiscount[i]));
  const G = toMinor(g0, minorUnit),
    D = toMinor(d0, minorUnit),
    N = toMinor(n0, minorUnit);
  const discounts =
    origin?.scope === "line"
      ? lines.map((_, i) => (i === target ? D : 0n))
      : allocateCumulative(D, gross.map(exact));
  const aligned = gross.every(
    (g) => g.n % (g.d * (minorUnit === 0 ? 100n : 1n)) === 0n,
  );
  const remainders = aligned
    ? gross.map((g, i) => toMinor(g, minorUnit) - discounts[i])
    : allocateCumulative(G - D, remaining.map(exact));
  const adjustments = aligned
    ? allocateCumulative(N - (G - D), remaining.map(exact))
    : [];
  const nets = aligned
    ? remainders.map((r, i) => r + adjustments[i])
    : allocateCumulative(N, remaining.map(exact));
  const originals = { gross: exact(g0), discount: exact(d0), net: exact(n0) };
  const deltas = {
    gross: exact(subtract(minorRational(G, minorUnit), g0)),
    discount: exact(subtract(minorRational(D, minorUnit), d0)),
    net: exact(subtract(minorRational(N, minorUnit), n0)),
  };
  return {
    gross: formatMinor(G, minorUnit),
    discount: formatMinor(D, minorUnit),
    roundingAdjustment: formatMinor(N - (G - D), minorUnit),
    collected: formatMinor(N, minorUnit),
    currencyCode: input.currencyCode,
    minorUnit,
    originals,
    normalizationAdjustments: deltas,
    lines: lines.map((line, i) => {
      const gi = discounts[i] + remainders[i],
        ni = nets[i],
        di = discounts[i],
        ni0 = subtract(gross[i], originalDiscount[i]);
      for (const amount of [gi, ni, di])
        assertMoneyRange(minorRational(amount, minorUnit));
      return {
        sourceLineId: line.sourceLineId,
        position: line.position,
        money: {
          gross: formatMinor(gi, minorUnit),
          discount: formatMinor(di, minorUnit),
          net: formatMinor(ni, minorUnit),
          roundingAdjustment: formatMinor(ni - remainders[i], minorUnit),
          originals: {
            gross: exact(gross[i]),
            discount: exact(originalDiscount[i]),
            net: exact(ni0),
          },
          normalizationAdjustments: {
            gross: exact(subtract(minorRational(gi, minorUnit), gross[i])),
            discount: exact(
              subtract(minorRational(di, minorUnit), originalDiscount[i]),
            ),
            net: exact(subtract(minorRational(ni, minorUnit), ni0)),
          },
        },
        discountOrigin:
          originalDiscount[i].n > 0n &&
          (origin?.scope === "order" || i === target)
            ? origin
            : null,
      };
    }),
  };
}
export function buildFinancialSettlement(
  input: SettlementInput,
): FinancialSettlement {
  return settle(input, buildFinancialAmounts(input));
}
/** Explicit adapter for trusted persisted unit tariffs/counts and measured snapshots. */
export function buildFinancialSettlementFromSnapshots(
  input: FinancialInputV2 & { payments: readonly PaymentInput[] },
): FinancialSettlement {
  return settle(input, buildFinancialAmountsFromSnapshots(input));
}
function settle(
  input: SettlementInput,
  amounts: FinancialAmounts,
): FinancialSettlement {
  const N = toMinor(originalMoney(amounts.collected), amounts.minorUnit),
    payments = input.payments;
  if (!Array.isArray(payments))
    throw new FinancialError(
      N === 0n ? "payments_not_expected" : "payment_required",
    );
  if (N === 0n) {
    if (payments.length) throw new FinancialError("payments_not_expected");
    return { ...amounts, payments: [], paymentOriginals: [] };
  }
  if (!payments.length)
    throw new FinancialError("payment_required", { settlement: amounts });
  if (new Set(payments.map((p) => p.methodId)).size !== payments.length)
    throw new FinancialError("duplicate_payment_method");
  let originals;
  try {
    originals = payments.map((p) => {
      if (!p.methodId || !p.paymentId) throw new Error();
      const v = originalMoney(p.amount);
      if (v.n <= 0n) throw new Error();
      return v;
    });
  } catch {
    throw new FinancialError("invalid_payment_amount");
  }
  for (const amount of originals) assertMoneyRange(amount, input.currencyCode);
  assertMoneyRange(originals.reduce(add, rational(0n)), input.currencyCode);
  if (new Set(payments.map((p) => p.paymentId)).size !== payments.length)
    throw new FinancialError("invalid_payment_amount");
  if (toMinor(originals.reduce(add, rational(0n)), amounts.minorUnit) !== N)
    throw new FinancialError("payment_sum_mismatch", { settlement: amounts });
  const allocated = allocateCumulative(N, originals.map(exact));
  const paymentOriginals = payments.map((p, i) => ({
    paymentId: p.paymentId,
    position: i,
    methodId: p.methodId,
    amount: formatMinor(allocated[i], amounts.minorUnit),
    originalAmount: exact(originals[i]),
    normalizationAdjustment: exact(
      subtract(minorRational(allocated[i], amounts.minorUnit), originals[i]),
    ),
    effective: allocated[i] > 0n,
  }));
  return {
    ...amounts,
    paymentOriginals,
    payments: paymentOriginals
      .filter((p) => p.effective)
      .map((p) => ({
        paymentId: p.paymentId,
        position: p.position,
        methodId: p.methodId,
        amount: p.amount,
        originalAmount: p.originalAmount,
        normalizationAdjustment: p.normalizationAdjustment,
      })),
  };
}
