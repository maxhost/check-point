import { add, rational } from "../../financial/rational";
import type { AnalyticsFact } from "../metrics";
import type {
  AnalyticsGauge,
  AnalyticsInput,
  CardCandidate,
  CardState,
} from "../types";
import { addDays, daysBetween, formatMoney } from "../date";
import { cardWeight, materialFingerprint } from "../weights";
import {
  decimal,
  decimalDifference,
  moneyRatio,
  sumIntegers,
  safeInteger,
} from "../money";

const recentRows = (input: AnalyticsInput) =>
  input.metrics.filter(
    (r) => r.day >= addDays(input.today, -28) && r.day < input.today,
  );
export function weighStockCard(
  input: AnalyticsInput,
  card: CardCandidate,
  states: readonly CardState[] = [],
) {
  const average =
    sumIntegers(
      recentRows(input)
        .filter((r) => r.metric === "revenue")
        .map((r) => r.amountMinor),
    ) / 28;
  return {
    ...card,
    weight: cardWeight(
      card,
      average,
      states.find(
        (s) => s.cardKey === card.cardKey && s.subjectKey === card.subjectKey,
      ),
    ),
  };
}
function candidate(
  input: AnalyticsInput,
  card: Omit<
    CardCandidate,
    "currencyCode" | "minorUnit" | "weight" | "fingerprint"
  >,
  states: readonly CardState[],
) {
  return weighStockCard(
    input,
    {
      ...card,
      currencyCode: input.currencyCode,
      minorUnit: input.minorUnit,
      weight: 0,
      fingerprint: materialFingerprint(card.subjectKey, card.amountMinor),
    },
    states,
  );
}
/** The most recent observation for each metric/local/item; event id breaks timestamp ties. */
export function latestGauges(gauges: readonly AnalyticsGauge[], to: string) {
  const latest = new Map<string, AnalyticsGauge>();
  for (const row of gauges) {
    if (row.day > to) continue;
    const key = `${row.metric}:${row.locationId}:${row.dimensionId}`;
    const previous = latest.get(key);
    if (
      !previous ||
      new Date(row.observedAt).getTime() >
        new Date(previous.observedAt).getTime() ||
      (new Date(row.observedAt).getTime() ===
        new Date(previous.observedAt).getTime() &&
        row.eventId > previous.eventId)
    )
      latest.set(key, row);
  }
  return [...latest.values()];
}
function quantile(sorted: number[], p: number) {
  const i = (sorted.length - 1) * p,
    lo = Math.floor(i),
    hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}
const quantityText = (value: number) =>
  new Intl.NumberFormat("es-EC", { maximumFractionDigits: 3 }).format(value);
function dayText(today: string, days: number) {
  if (days <= 0) return "hoy";
  return new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${addDays(today, Math.ceil(days))}T12:00:00Z`));
}
export function buildStockCandidates(
  input: AnalyticsInput,
  states: readonly CardState[] = [],
): CardCandidate[] {
  const rows = recentRows(input);
  return latestGauges(input.gauges ?? [], input.today)
    .filter((g) => g.metric === "stock_on_hand" && g.locationId)
    .flatMap((g) => {
      const consumption = input.metrics.filter(
        (r) =>
          r.metric === "stock_consumption" &&
          r.locationId === g.locationId &&
          r.dimensionId === g.dimensionId,
      );
      const first =
        input.firstConsumptionDays?.find(
          (d) => d.locationId === g.locationId && d.itemId === g.dimensionId,
        )?.day ?? consumption.map((r) => r.day).sort()[0];
      if (!first || daysBetween(first, input.today) < 28) return [];
      const daily = Array.from({ length: 28 }, (_, i) => {
        const day = addDays(input.today, -(i + 1));
        return rows
          .filter(
            (r) =>
              r.metric === "stock_consumption" &&
              r.locationId === g.locationId &&
              r.dimensionId === g.dimensionId &&
              r.day === day,
          )
          .reduce((n, r) => n + r.quantity, 0);
      }).sort((a, b) => a - b);
      const fast = quantile(daily, 0.75),
        slow = quantile(daily, 0.25);
      if (fast <= 0) return [];
      const stock = Math.max(0, Number(g.quantity)),
        short = stock / fast;
      if (short > 4) return [];
      const long = slow > 0 ? stock / slow : null;
      const label =
        input.labels.find((l) => l.kind === "item" && l.id === g.dimensionId)
          ?.label ?? "este insumo";
      const location = input.locations.find((l) => l.id === g.locationId)?.name;
      const range =
        long === null
          ? `se podría acabar desde ${dayText(input.today, short)}; hay días sin consumo y todavía no puedo acotar el otro extremo`
          : `se acabaría entre ${dayText(input.today, short)} y ${dayText(input.today, long)}`;
      return [
        candidate(
          input,
          {
            cardKey: "8",
            subjectKey: `${g.locationId}:${g.dimensionId}`,
            sender: "Stock",
            title: `Te estás quedando sin ${label}`,
            body: `Quedan ${quantityText(stock)}${g.unit ? ` ${g.unit}` : " unidades"}${location && input.locations.length > 1 ? ` en ${location}` : ""}: ${range}.`,
            amountMinor: null,
            fixedPlata: 1,
            urgency: 1 - short / 5,
            quality: "estimated",
            actionKey: "record_purchase",
            locationId: g.locationId,
          },
          states,
        ),
      ];
    });
}
/** Captured facts are supplied by the translator. No source tables or module names. */
export function buildFactCandidates(
  input: AnalyticsInput,
  facts: readonly AnalyticsFact[],
  eventId: string,
  dayOf: (instant: string) => string,
  states: readonly CardState[] = [],
): CardCandidate[] {
  const rows = recentRows(input);
  return facts.flatMap((fact) => {
    if (
      fact.currencyCode !== input.currencyCode ||
      fact.minorUnit !== input.minorUnit
    )
      return [];
    const originDay = dayOf(fact.occurredAt),
      age = daysBetween(originDay, input.today);
    if (age < 0) return [];
    const base = {
      originDay,
      originObservedAt: `${new Date(fact.occurredAt).toISOString()}:${eventId}`,
      locationId: fact.locationId,
      urgency: 1,
      weightMultiplier: 0.7 ** age,
    };
    if (fact.kind === "unit_cost_change") {
      const before = decimal(fact.itemUnitCostBefore),
        delta = decimalDifference(
          fact.itemUnitCostAfter,
          fact.itemUnitCostBefore,
        );
      if (before.n <= 0n || delta.n * before.d * 100n < before.n * delta.d * 5n)
        return [];
      const productDelta = decimalDifference(
        fact.unitCostAfter,
        fact.unitCostBefore,
      );
      if (productDelta.n <= 0n) return [];
      const q = rows
        .filter(
          (r) =>
            r.metric === "units_sold" &&
            r.dimensionId === fact.productId &&
            r.locationId === fact.locationId,
        )
        .reduce(
          (total, r) => add(total, decimal(String(r.quantity))),
          rational(0n),
        );
      const weekly = moneyRatio(
        productDelta.n * 10n ** BigInt(input.minorUnit) * q.n,
        productDelta.d * q.d * 4n,
      );
      const rise =
        (Number(delta.n * before.d) / Number(delta.d * before.n)) * 100;
      const unitMoney = new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: input.currencyCode,
        minimumFractionDigits: input.minorUnit,
        maximumFractionDigits: 6,
      }).format(Number(productDelta.n) / Number(productDelta.d));
      return [
        candidate(
          input,
          {
            ...base,
            cardKey: "5",
            subjectKey: `${fact.locationId}:${fact.itemId}:${fact.productId}`,
            sender: "Costos",
            title: `Subió ${fact.itemLabel}`,
            body: `${fact.itemLabel} subió ${Math.round(rise)}%: tu ${fact.productLabel} te cuesta ${unitMoney} más por unidad (≈${formatMoney(weekly, input.currencyCode, input.minorUnit)} por semana con lo que vendes).`,
            amountMinor: weekly,
            quality: "estimated",
            actionKey: "edit_product_price",
          },
          states,
        ),
      ];
    }
    const loss = safeInteger(-BigInt(fact.amountMinor)),
      quantity = -Number(fact.quantity);
    const weeklySales = sumIntegers(
      input.metrics
        .filter(
          (r) =>
            r.metric === "revenue" &&
            r.locationId === fact.locationId &&
            r.day >= addDays(originDay, -7) &&
            r.day < originDay,
        )
        .map((r) => r.amountMinor),
    );
    const localRevenue = rows.filter(
      (r) => r.metric === "revenue" && r.locationId === fact.locationId,
    );
    const totalSales = sumIntegers(localRevenue.map((r) => r.amountMinor));
    const tickets = sumIntegers(localRevenue.map((r) => r.count));
    if (
      quantity <= 0 ||
      loss < 0 ||
      (tickets > 0 && BigInt(loss) * BigInt(tickets) < BigInt(totalSales)) ||
      BigInt(loss) * 100n < BigInt(weeklySales)
    )
      return [];
    return [
      candidate(
        input,
        {
          ...base,
          cardKey: "9",
          subjectKey: `${eventId}:${fact.itemId}`,
          sender: "Stock",
          title: `Faltó ${fact.itemLabel} en el conteo`,
          body: `Faltaron ${quantityText(quantity)}${fact.itemUnit ? ` ${fact.itemUnit}` : " unidades"} de ${fact.itemLabel} (~${formatMoney(loss, input.currencyCode, input.minorUnit)}) que no explican las ventas.`,
          amountMinor: loss,
          quality: "observed",
          actionKey: "view_count_detail",
          actionHref: fact.actionHref,
        },
        states,
      ),
    ];
  });
}
export function carryFactCandidate(
  input: AnalyticsInput,
  card: CardCandidate,
  states: readonly CardState[] = [],
) {
  if (!card.originDay || (card.cardKey !== "5" && card.cardKey !== "9"))
    return null;
  const age = daysBetween(card.originDay, input.today);
  if (age < 0) return null;
  return weighStockCard(
    input,
    { ...card, urgency: 1, weightMultiplier: 0.7 ** age },
    states,
  );
}
