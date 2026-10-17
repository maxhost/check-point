import { addDays, daysBetween, formatMoney, monthStart } from "../date";
import { customerCohorts } from "../customer-promo-history";
import { moneyRatio, sumIntegers } from "../money";
import type { AnalyticsInput, CardCandidate, CardState } from "../types";
import { cardWeight, materialFingerprint } from "../weights";

// §7 leaves urgency open: anomalies 0.8, habitual loss 0.7, completed promo 0.6.
export const CUSTOMER_PROMO_URGENCY = {
  "10": 0.8,
  "11": 0.7,
  "12": 0.6,
} as const;
export function buildCustomerPromoCandidates(
  input: AnalyticsInput,
  states: readonly CardState[] = [],
): CardCandidate[] {
  const cards: CardCandidate[] = [];
  const money = (n: number) =>
    formatMoney(n, input.currencyCode, input.minorUnit);
  const sum = (
    rows: typeof input.metrics,
    metric: string,
    field: "count" | "amountMinor" = "amountMinor",
  ) =>
    sumIntegers(
      rows
        .filter(
          (r) =>
            r.metric === metric &&
            (field === "count" ||
              (r.currencyCode === input.currencyCode &&
                r.minorUnit === input.minorUnit)),
        )
        .map((r) => r[field]),
    );
  const avg =
    sum(
      input.metrics.filter(
        (r) => r.day >= addDays(input.today, -28) && r.day < input.today,
      ),
      "revenue",
    ) / 28;
  function add(
    card: Omit<
      CardCandidate,
      "currencyCode" | "minorUnit" | "fingerprint" | "weight" | "urgency"
    >,
  ) {
    const candidate: CardCandidate = {
      ...card,
      currencyCode: input.currencyCode,
      minorUnit: input.minorUnit,
      urgency: CUSTOMER_PROMO_URGENCY[card.cardKey as "10" | "11" | "12"],
      fingerprint: materialFingerprint(card.subjectKey, card.amountMinor),
      weight: 0,
    };
    candidate.weight = cardWeight(
      candidate,
      avg,
      states.find(
        (s) => s.cardKey === card.cardKey && s.subjectKey === card.subjectKey,
      ),
    );
    cards.push(candidate);
  }
  for (const location of input.locations) {
    const first = input.firstSaleDays?.find(
      (r) => r.locationId === location.id,
    )?.day;
    if (!first || daysBetween(first, input.today) < 28) continue;
    const rows = input.metrics.filter((r) => r.locationId === location.id);
    const current = rows.filter(
      (r) => r.day >= addDays(input.today, -7) && r.day < input.today,
    );
    const weeks = Array.from({ length: 8 }, (_, i) =>
      sum(
        rows.filter(
          (r) =>
            r.day >= addDays(input.today, -14 - i * 7) &&
            r.day < addDays(input.today, -7 - i * 7),
        ),
        "voided_tickets",
        "count",
      ),
    );
    const mean = weeks.reduce((a, b) => a + b, 0) / 8;
    const sd = Math.sqrt(weeks.reduce((n, v) => n + (v - mean) ** 2, 0) / 8);
    const count = sum(current, "voided_tickets", "count");
    if (count <= Math.max(3, mean + 2 * sd)) continue;
    const amount = sum(current, "voided_tickets");
    add({
      cardKey: "10",
      subjectKey: `voids:${location.id}`,
      sender: "Ventas",
      title: "Más tickets anulados",
      body: `Esta semana se anularon ${count} tickets en ${location.name} (${money(amount)} cargados). El promedio de las 8 semanas previas fue ${Number(mean.toFixed(1))}.`,
      amountMinor: amount,
      quality: "observed",
      actionKey: "view_voided_orders",
      locationId: location.id,
    });
  }
  for (const customer of customerCohorts(input)) {
    const gap = daysBetween(customer.lastDay, input.today),
      med = customer.medianDays;
    // Owner: at least four distinct local dates define the habit.
    if (
      customer.visitDays < 4 ||
      gap > 90 ||
      med <= 0 ||
      gap <= 2 * med ||
      gap < med + 7
    )
      continue;
    const missed = Math.max(
      0,
      Math.floor(gap / med) -
        Math.floor(
          Math.max(
            0,
            daysBetween(customer.lastDay, monthStart(input.today)) - 1,
          ) / med,
        ),
    );
    const amount = customer.allAmountsKnown
      ? moneyRatio(
          BigInt(customer.spentMinor) * BigInt(missed),
          BigInt(customer.visitDays),
        )
      : null;
    const name =
      input.labels.find((l) => l.kind === "customer" && l.id === customer.id)
        ?.label || "Este cliente";
    add({
      cardKey: "11",
      subjectKey: `customer:${customer.id}`,
      sender: "Clientes",
      title: "Un habitual lleva más tiempo sin venir",
      body: `${name} solía venir cada ${med} días. Su última visita fue hace ${gap} días.`,
      amountMinor: amount,
      quality: "estimated",
      actionKey: "view_customer",
      actionHref: `/backoffice/customers/analytics/${customer.id}`,
      locationId: null,
      ...(amount === null ? { fixedPlata: 1 } : {}),
    });
  }
  for (const campaign of input.campaigns ?? []) {
    if (campaign.status === "draft") continue;
    const finish = [campaign.endsAt, campaign.endedAt]
      .filter((v): v is string => !!v)
      .sort()[0];
    if (!finish || addDays(finish.slice(0, 10), 1) !== input.today) continue;
    const rows = input.metrics.filter(
      (r) =>
        r.dimensionId === campaign.campaignId &&
        r.day >= campaign.startsAt.slice(0, 10) &&
        r.day <= finish.slice(0, 10),
    );
    const discount = sum(rows, "promo_discount"),
      sales = sum(rows, "promo_sales");
    add({
      cardKey: "12",
      subjectKey: `campaign:${campaign.campaignId}`,
      sender: "Promos",
      title: "El resultado de tu promo",
      body: `${campaign.label} te costó ${money(discount)} en descuentos y vino con ${money(sales)} en ventas en los mismos tickets. Estas ventas no indican que la promo las haya causado.`,
      amountMinor: discount,
      quality: "observed",
      actionKey: "view_campaign_results",
      actionHref: `/backoffice/marketing/${campaign.campaignId}`,
      locationId: null,
      ...(discount === 0 ? { fixedPlata: 1 } : {}),
    });
  }
  return cards;
}
