import {
  FinancialError,
  type ExactAmount,
  type FinancialSettlement,
} from "./types";
import {
  add,
  exact,
  formatMinor,
  fromExact,
  minorRational,
  minorUnitForCurrency,
  rational,
  subtract,
  toMinor,
  type Rational,
} from "./rational";
const invalid = () => {
  throw new FinancialError("invalid_financial_input");
};
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : invalid();
function canonicalExact(v: unknown): Rational {
  const input = object(v) as ExactAmount,
    r = fromExact(input),
    canonical = exact(r);
  if (
    canonical.numerator !== input.numerator ||
    canonical.denominator !== input.denominator ||
    input.scale !== 2
  )
    invalid();
  return r;
}
const equal = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
function operational(v: unknown, minor: 0 | 2, signed = false) {
  if (
    typeof v !== "string" ||
    !(minor === 0 ? /^-?\d+$/ : /^-?\d+\.\d{2}$/).test(v)
  )
    return invalid();
  const n = BigInt(v.replace(".", ""));
  if ((!signed && n < 0n) || formatMinor(n, minor) !== v) return invalid();
  return n;
}
function moneyBlock(v: unknown, minor: 0 | 2, netKey: "net" | "collected") {
  const m = object(v),
    g = operational(m.gross, minor),
    d = operational(m.discount, minor),
    n = operational(m[netKey], minor),
    a = operational(m.roundingAdjustment, minor, true);
  if (d > g || g - d + a !== n) invalid();
  const originals = object(m.originals),
    adjustments = object(m.normalizationAdjustments),
    og = canonicalExact(originals.gross),
    od = canonicalExact(originals.discount),
    on = canonicalExact(originals.net);
  if (og.n < 0n || od.n < 0n || on.n < 0n || !equal(subtract(og, od), on))
    invalid();
  for (const [key, amount, original] of [
    ["gross", g, og],
    ["discount", d, od],
    ["net", n, on],
  ] as const)
    if (
      !equal(
        subtract(minorRational(amount, minor), original),
        canonicalExact(adjustments[key]),
      )
    )
      invalid();
  return { g, d, n, a, og, od, on };
}
/** Validates durable data without reselecting a discount or redistributing it. */
export function assertFinancialSettlement(
  value: unknown,
): asserts value is FinancialSettlement {
  try {
    const s = object(value),
      minor = minorUnitForCurrency(s.currencyCode as string);
    if (
      s.minorUnit !== minor ||
      !Array.isArray(s.lines) ||
      !s.lines.length ||
      !Array.isArray(s.payments) ||
      !Array.isArray(s.paymentOriginals)
    )
      invalid();
    const total = moneyBlock(s, minor, "collected"),
      sums = {
        g: 0n,
        d: 0n,
        n: 0n,
        a: 0n,
        og: rational(0n),
        od: rational(0n),
        on: rational(0n),
      },
      seen = new Set<string>();
    let lastPosition = -1,
      lastId = "";
    for (const raw of s.lines as unknown[]) {
      const line = object(raw),
        id = line.sourceLineId,
        position = line.position;
      if (
        typeof id !== "string" ||
        !id ||
        seen.has(id) ||
        !Number.isSafeInteger(position) ||
        Number(position) < 0 ||
        Number(position) < lastPosition ||
        (position === lastPosition && id.localeCompare(lastId) < 0)
      )
        invalid();
      seen.add(id as string);
      lastId = id as string;
      lastPosition = position as number;
      const block = moneyBlock(line.money, minor, "net");
      for (const key of ["g", "d", "n", "a"] as const) sums[key] += block[key];
      for (const key of ["og", "od", "on"] as const)
        sums[key] = add(sums[key], block[key]);
      if (block.od.n === 0n) {
        if (line.discountOrigin !== null) invalid();
      } else {
        const origin = object(line.discountOrigin);
        if (
          !["campaign_coupon", "program_reward"].includes(
            String(origin.type),
          ) ||
          typeof origin.sourceId !== "string" ||
          !["order", "line"].includes(String(origin.scope)) ||
          (origin.scope === "line" && origin.targetSourceLineId !== id)
        )
          invalid();
      }
    }
    for (const key of ["g", "d", "n", "a"] as const)
      if (sums[key] !== total[key]) invalid();
    for (const key of ["og", "od", "on"] as const)
      if (!equal(sums[key], total[key])) invalid();
    const originals = s.paymentOriginals as unknown[],
      payments = s.payments as unknown[],
      effective = new Map<string, Record<string, unknown>>(),
      methods = new Set<string>(),
      paymentIds = new Set<string>();
    let paid = 0n,
      originalPaid = rational(0n);
    for (const [i, raw] of originals.entries()) {
      const p = object(raw),
        amount = operational(p.amount, minor),
        original = canonicalExact(p.originalAmount);
      if (
        p.position !== i ||
        typeof p.paymentId !== "string" ||
        !p.paymentId ||
        paymentIds.has(p.paymentId as string) ||
        typeof p.methodId !== "string" ||
        methods.has(p.methodId) ||
        original.n <= 0n ||
        p.effective !== amount > 0n ||
        !equal(
          subtract(minorRational(amount, minor), original),
          canonicalExact(p.normalizationAdjustment),
        )
      )
        invalid();
      methods.add(p.methodId as string);
      paymentIds.add(p.paymentId as string);
      paid += amount;
      originalPaid = add(originalPaid, original);
      if (amount > 0n) effective.set(p.paymentId as string, p);
    }
    if (
      paid !== total.n ||
      toMinor(originalPaid, minor) !== total.n ||
      (total.n === 0n && (originals.length || payments.length)) ||
      effective.size !== payments.length
    )
      invalid();
    for (const raw of payments) {
      const p = object(raw),
        audit = effective.get(p.paymentId as string);
      if (!audit) invalid();
      for (const key of [
        "paymentId",
        "position",
        "methodId",
        "amount",
      ] as const)
        if (p[key] !== audit![key]) invalid();
      for (const key of ["originalAmount", "normalizationAdjustment"] as const)
        if (!equal(canonicalExact(p[key]), canonicalExact(audit![key])))
          invalid();
      effective.delete(p.paymentId as string);
    }
    if (effective.size) invalid();
  } catch (error) {
    if (error instanceof FinancialError) throw error;
    invalid();
  }
}
