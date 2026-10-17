import {
  addDays,
  addMonths,
  daysBetween,
  formatMoney,
  median,
  monthEnd,
  monthStart,
  weekday,
} from "../date";
import type {
  AnalyticsInput,
  AnalyticsMetric,
  CardCandidate,
  CardState,
} from "../types";
import { cardWeight, materialFingerprint } from "../weights";
const sum = (
  rows: readonly AnalyticsMetric[],
  metric: string,
  field: "amountMinor" | "quantity" | "count" = "amountMinor",
) => rows.filter((r) => r.metric === metric).reduce((n, r) => n + r[field], 0);
const period = (rows: readonly AnalyticsMetric[], from: string, to: string) =>
  rows.filter((r) => r.day >= from && r.day <= to);
export type ProductSummary = {
  id: string;
  label: string;
  revenue: number;
  units: number;
  knownUnits: number;
  salesCount: number;
  cost: number;
  profitPerUnit: number | null;
};
export function products(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[],
): ProductSummary[] {
  const ids = [
    ...new Set(
      rows
        .filter((r) =>
          [
            "product_revenue",
            "units_sold",
            "cost_of_goods",
            "units_with_cost",
          ].includes(r.metric),
        )
        .map((r) => r.dimensionId ?? "unlisted"),
    ),
  ];
  return ids.map((id) => {
    const product = rows.filter((r) => (r.dimensionId ?? "unlisted") === id);
    const revenue = sum(product, "product_revenue");
    const units = sum(product, "units_sold", "quantity");
    const knownUnits = sum(product, "units_with_cost", "quantity");
    const cost = sum(product, "cost_of_goods");
    return {
      id,
      label:
        input.labels.find((l) => l.kind === "product" && l.id === id)?.label ??
        (id === "unlisted" ? "Producto sin catálogo" : "Producto"),
      revenue,
      units,
      knownUnits,
      salesCount: sum(product, "product_revenue", "count"),
      cost,
      profitPerUnit:
        knownUnits > 0 && units > 0
          ? (revenue * Math.min(1, knownUnits / units) - cost) / knownUnits
          : null,
    };
  });
}
export function contribution(
  input: AnalyticsInput,
  rows: readonly AnalyticsMetric[],
) {
  const product = products(input, rows);
  const units = sum(rows, "units_sold", "quantity");
  const knownUnits = product.reduce(
    (n, p) => n + Math.min(p.units, p.knownUnits),
    0,
  );
  const revenue = sum(rows, "revenue");
  const knownRevenue = product.reduce(
    (n, p) =>
      n + (p.units > 0 ? p.revenue * Math.min(1, p.knownUnits / p.units) : 0),
    0,
  );
  const goods = sum(rows, "cost_of_goods");
  const commission = sum(rows, "payment_commission");
  const knownCommission =
    revenue > 0 ? (commission * knownRevenue) / revenue : 0;
  return {
    coverage: units > 0 ? knownUnits / units : 0,
    revenue,
    knownRevenue,
    goods,
    commission,
    grossProfit: knownRevenue - goods - knownCommission,
    margin:
      knownRevenue > 0
        ? (knownRevenue - goods - knownCommission) / knownRevenue
        : 0,
  };
}
export type GoalCalculation = {
  expensesMinor: number;
  estimated: boolean;
  concepts: {
    id: string;
    label: string;
    amountMinor: number;
    estimated: boolean;
  }[];
  closedMonth: boolean;
  coverage: number;
  margin: number;
  breakEvenMinor: number | null;
  monthRevenueMinor: number;
  remainingDays: number;
  targetMinor: number | null;
  atRisk: boolean;
};
export function calculateGoal(input: AnalyticsInput): GoalCalculation {
  const { today, metrics } = input;
  const start = monthStart(today);
  const closed = period(metrics, addMonths(start, -3), addDays(start, -1));
  const current = period(metrics, start, today);
  const recent = period(metrics, addDays(today, -28), addDays(today, -1));
  const c = contribution(input, recent);
  const concepts = [
    ...new Set(
      [...metrics.filter((r) => r.day < start), ...current]
        .filter((r) => r.metric === "expense_fixed")
        .map((r) => r.dimensionId ?? "unknown"),
    ),
  ].map((id) => {
    const thisMonth = current.filter(
      (r) =>
        r.metric === "expense_fixed" &&
        (r.dimensionId ?? "unknown") === id &&
        r.amountMinor > 0,
    );
    const previous = new Map<string, number>();
    for (const row of metrics.filter(
      (r) =>
        r.day < start &&
        r.metric === "expense_fixed" &&
        (r.dimensionId ?? "unknown") === id,
    ))
      previous.set(
        row.day.slice(0, 7),
        (previous.get(row.day.slice(0, 7)) ?? 0) + row.amountMinor,
      );
    const paidMonths = [...previous.entries()]
      .filter(([, amount]) => amount > 0)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)
      .map(([, amount]) => amount);
    return {
      id,
      label:
        input.labels.find((l) => l.kind === "concept" && l.id === id)?.label ??
        "Gasto fijo",
      amountMinor: thisMonth.length
        ? sum(thisMonth, "expense_fixed")
        : paidMonths.length
          ? paidMonths.reduce((n, v) => n + v, 0) / paidMonths.length
          : 0,
      estimated: !thisMonth.length,
    };
  });
  const variable = sum(closed, "expense_variable") / 3;
  const expensesMinor = Math.round(
    concepts.reduce((n, c) => n + c.amountMinor, 0) + variable,
  );
  const monthRevenueMinor = sum(current, "revenue");
  const closedMonth = metrics
    .filter((r) => r.day < start)
    .some((r) => r.metric.startsWith("expense_") && r.amountMinor > 0);
  const weekdays = new Set(
    recent
      .filter((r) => r.metric === "revenue" && r.amountMinor > 0)
      .map((r) => weekday(r.day)),
  );
  let remainingDays = 0;
  for (let day = today; day <= monthEnd(today); day = addDays(day, 1))
    if (weekdays.has(weekday(day))) remainingDays++;
  const breakEvenMinor =
    closedMonth && c.coverage >= 0.8 && c.margin > 0
      ? Math.ceil(expensesMinor / c.margin)
      : null;
  const elapsed = Number(today.slice(8)) - 1;
  const days = Number(monthEnd(today).slice(8));
  const atRisk =
    breakEvenMinor !== null &&
    monthRevenueMinor < (breakEvenMinor * Math.max(1, elapsed)) / days;
  return {
    expensesMinor,
    estimated: concepts.some((c) => c.estimated) || variable > 0,
    concepts,
    closedMonth,
    coverage: c.coverage,
    margin: c.margin,
    breakEvenMinor,
    monthRevenueMinor,
    remainingDays,
    targetMinor:
      breakEvenMinor !== null &&
      breakEvenMinor > monthRevenueMinor &&
      remainingDays > 0 &&
      atRisk
        ? Math.ceil((breakEvenMinor - monthRevenueMinor) / remainingDays)
        : null,
    atRisk,
  };
}
export function buildCandidates(
  input: AnalyticsInput,
  states: readonly CardState[] = [],
): CardCandidate[] {
  const { today, metrics } = input;
  const yesterday = addDays(today, -1);
  const recent = period(metrics, addDays(today, -28), yesterday);
  const goal = calculateGoal(input);
  const average = sum(recent, "revenue") / 28;
  const money = (n: number) =>
    formatMoney(Math.round(n), input.currencyCode, input.minorUnit);
  const candidates: CardCandidate[] = [];
  const add = (
    card: Omit<
      CardCandidate,
      "currencyCode" | "minorUnit" | "fingerprint" | "weight" | "locationId"
    >,
  ) => {
    const candidate: CardCandidate = {
      ...card,
      currencyCode: input.currencyCode,
      minorUnit: input.minorUnit,
      locationId: null,
      fingerprint: materialFingerprint(card.subjectKey, card.amountMinor),
      weight: 0,
    };
    candidate.weight = cardWeight(
      candidate,
      average,
      states.find(
        (s) => s.cardKey === card.cardKey && s.subjectKey === card.subjectKey,
      ),
    );
    candidates.push(candidate);
  };
  const yesterdayRows = period(metrics, yesterday, yesterday);
  const yesterdayRevenue = sum(yesterdayRows, "revenue");
  if (yesterdayRevenue > 0) {
    const previous = sum(
      period(metrics, addDays(yesterday, -7), addDays(yesterday, -7)),
      "revenue",
    );
    const top = products(input, yesterdayRows).sort(
      (a, b) => b.units - a.units,
    )[0];
    const comparison =
      previous > 0
        ? `, ${Math.round(Math.abs(yesterdayRevenue / previous - 1) * 100)}% ${yesterdayRevenue >= previous ? "más" : "menos"} que el mismo día de la semana pasada`
        : "";
    const byLocation =
      input.locations.length > 1
        ? input.locations
            .map((l) => {
              const rows = yesterdayRows.filter((r) => r.locationId === l.id);
              return sum(rows, "revenue") > 0
                ? `${l.name}: ${money(sum(rows, "revenue"))} en ${sum(rows, "revenue", "count")} tickets.`
                : "";
            })
            .filter(Boolean)
            .join("\n")
        : "";
    add({
      cardKey: "1",
      subjectKey: yesterday,
      sender: "Ventas",
      title: "Tu resumen de ayer",
      body: `Ayer vendiste ${money(yesterdayRevenue)} en ${sum(yesterdayRows, "revenue", "count")} tickets${comparison}.${top ? ` Lo que más salió: ${top.label} (${top.units}).` : ""}${byLocation ? `\n${byLocation}` : ""}`,
      amountMinor: yesterdayRevenue,
      quality: "observed",
      actionKey: "view_day",
      actionHref: `/backoffice/analytics?date=${yesterday}`,
      urgency: 1,
    });
  }
  const first =
    input.firstSaleDay ??
    metrics
      .filter((r) => r.metric === "revenue" && r.amountMinor > 0)
      .map((r) => r.day)
      .sort()[0];
  const sameDays = [
    ...new Set(
      metrics
        .filter(
          (r) =>
            r.metric === "revenue" &&
            r.amountMinor > 0 &&
            r.day < today &&
            weekday(r.day) === weekday(today),
        )
        .map((r) => r.day),
    ),
  ]
    .sort()
    .reverse()
    .slice(0, 8);
  const ready =
    !!first && daysBetween(first, today) >= 28 && sameDays.length >= 4;
  const dayName = new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T12:00:00Z`));
  if (ready) {
    const forecasts = products(
      input,
      metrics.filter((r) => sameDays.includes(r.day)),
    )
      .map((p) => ({
        ...p,
        expected: median(
          sameDays.map((day) =>
            sum(
              metrics.filter((r) => r.day === day && r.dimensionId === p.id),
              "units_sold",
              "quantity",
            ),
          ),
        ),
      }))
      .sort((a, b) => b.expected - a.expected)
      .filter((p) => p.expected > 0)
      .slice(0, 3);
    if (forecasts.length)
      add({
        cardKey: "2",
        subjectKey: String(weekday(today)),
        sender: "Ventas",
        title: "Qué se vende hoy",
        body: `Los ${dayName} se suelen vender ${forecasts.map((p) => `unas ${Math.round(p.expected)} unidades de ${p.label}`).join(", ")}.`,
        amountMinor: null,
        fixedPlata: 0.1,
        urgency: 1,
        quality: "observed",
        actionKey: null,
      });
  } else if (
    first &&
    !states.some(
      (s) =>
        s.cardKey === "2" &&
        s.subjectKey.startsWith("learning:") &&
        s.lastShownDay &&
        daysBetween(s.lastShownDay, today) < 7,
    )
  ) {
    add({
      cardKey: "2",
      subjectKey: `learning:${today}`,
      sender: "Ventas",
      title: "Conociendo tus ventas",
      body: `Necesito ${Math.max(1, 4 - sameDays.length)} ${dayName} más${daysBetween(first, today) < 28 ? " y completar 28 días desde tu primera venta" : ""} para decirte qué se vende los ${dayName}.`,
      amountMinor: null,
      fixedPlata: 0.1,
      urgency: 1,
      quality: "observed",
      actionKey: null,
    });
  }
  const daysLeft = daysBetween(today, monthEnd(today)) + 1;
  const lastTen = daysLeft <= 10;
  if (goal.targetMinor !== null) {
    const gap = Math.max(
      0,
      (goal.breakEvenMinor ?? 0) *
        (Number(today.slice(8)) / Number(monthEnd(today).slice(8))) -
        goal.monthRevenueMinor,
    );
    add({
      cardKey: "3",
      subjectKey: monthStart(today),
      sender: "Finanzas",
      title: "Tu meta de hoy",
      body: `Hoy necesitas vender ${money(goal.targetMinor)} para cubrir el mes: te faltan ${money((goal.breakEvenMinor ?? 0) - goal.monthRevenueMinor)} en ${goal.remainingDays} días de venta.`,
      amountMinor: Math.round(gap),
      urgency: 1 - daysLeft / Number(monthEnd(today).slice(8)),
      weightMultiplier: lastTen ? 1.5 : 1,
      quality: goal.estimated ? "estimated" : "observed",
      actionKey: "view_calculation",
      actionHref: "/backoffice/analytics?period=month#calculo",
    });
  }
  const hasFixed = metrics.some(
    (r) =>
      r.day >= addDays(today, -45) &&
      r.day <= today &&
      r.metric === "expense_fixed" &&
      r.amountMinor > 0,
  );
  if (!hasFixed || !goal.closedMonth) {
    const firstMonth =
      metrics.some(
        (r) =>
          r.day >= monthStart(today) &&
          r.day <= today &&
          r.metric.startsWith("expense_") &&
          r.amountMinor > 0,
      ) && !goal.closedMonth;
    add({
      cardKey: "4",
      subjectKey: "expenses",
      sender: "Finanzas",
      title: firstMonth
        ? "Tu primer mes con gastos"
        : "Completa tus gastos fijos",
      body: firstMonth
        ? "La meta se calcula al cerrar tu primer mes con gastos."
        : "Carga tus gastos fijos (alquiler, sueldos, luz) y te digo cuánto tienes que vender cada día para cubrir el mes.",
      amountMinor: null,
      fixedPlata: 1,
      urgency: lastTen ? 0.8 : 0.5,
      quality: "observed",
      actionKey: "record_expense",
    });
  }
  const recentProducts = products(input, recent);
  const known = recentProducts.filter(
    (p) => p.salesCount >= 10 && p.profitPerUnit !== null,
  );
  const profitMedian = median(
    recentProducts
      .filter((p) => p.profitPerUnit !== null)
      .map((p) => p.profitPerUnit!),
  );
  for (const p of known.filter(
    (p) => p.profitPerUnit! < 0 || p.profitPerUnit! < profitMedian / 2,
  )) {
    const negative = p.profitPerUnit! < 0;
    const amount =
      ((negative ? -p.profitPerUnit! : profitMedian - p.profitPerUnit!) *
        p.units) /
      4;
    add({
      cardKey: "6",
      subjectKey: p.id,
      sender: "Costos",
      title: negative
        ? "Un producto te hace perder dinero"
        : "Un margen para revisar",
      body: negative
        ? `Cada ${p.label} te hace perder ${money(-p.profitPerUnit!)}. Vendiste ${p.units} en 4 semanas.`
        : `${p.label} te deja ${money(p.profitPerUnit!)} por unidad, contra ${money(profitMedian)} de tus otros productos: vendiste ${p.units} en 4 semanas.`,
      amountMinor: Math.round(amount),
      urgency: goal.atRisk || goal.margin <= 0 ? 1 : 0.3,
      quality: "observed",
      actionKey: "edit_product_price",
    });
  }
  const unknown = recentProducts
    .filter((p) => p.units > p.knownUnits)
    .sort((a, b) => b.revenue - a.revenue);
  if (unknown.length) {
    const revenue = unknown.reduce(
      (n, p) => n + p.revenue * (1 - Math.min(1, p.knownUnits / p.units)),
      0,
    );
    add({
      cardKey: "7",
      subjectKey: unknown[0]!.id,
      sender: "Costos",
      title: "Falta conocer tus costos",
      body: `No sé cuánto ganas con ${unknown[0]!.label}${unknown.length > 1 ? ` y ${unknown.length - 1} productos más` : ""}: vendiste ${money(revenue)} de ellos en 4 semanas.`,
      amountMinor: Math.round(revenue / 4),
      urgency: goal.coverage < 0.8 ? 1 : 0.6,
      quality: "observed",
      actionKey: "set_product_cost",
    });
  }
  const costedProducts = recentProducts.filter((p) => p.profitPerUnit !== null);
  if (
    ready &&
    costedProducts.length >= 2 &&
    sum(recent, "revenue", "count") >= 10
  ) {
    const expected = median(
      sameDays.map((day) =>
        sum(
          metrics.filter((r) => r.day === day),
          "revenue",
        ),
      ),
    );
    if (expected < average * 0.75) {
      const best = [...costedProducts]
        .sort((a, b) => b.profitPerUnit! - a.profitPerUnit!)
        .slice(0, 2);
      add({
        cardKey: "13",
        subjectKey: String(weekday(today)),
        sender: "Ventas",
        title: "Aprovecha las recomendaciones",
        body: `Los ${dayName} suelen ser flojos (unos ${money(expected)}, contra ${money(average)} de un día promedio). Si te piden recomendación: ${best.map((p) => `${p.label} te deja ${money(p.profitPerUnit!)} por unidad`).join(" y ")}.`,
        amountMinor: Math.round(average - expected),
        urgency: goal.targetMinor !== null ? 1 : 0.7,
        quality: "observed",
        actionKey: null,
      });
    }
  }
  return candidates;
}
