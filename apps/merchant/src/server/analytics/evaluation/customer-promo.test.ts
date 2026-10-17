import { describe, expect, it } from "vitest";
import { buildCustomerPromoCandidates } from "@mi-pasaporte/domain/analytics/cards/customer-promo";
import {
  customerCohorts,
  summarizeCustomerPromoHistory,
} from "@mi-pasaporte/domain/analytics/customer-promo-history";
import { addDays } from "@mi-pasaporte/domain/analytics/date";
import { resolveAction } from "../actions";
import type {
  AnalyticsInput,
  AnalyticsMetric,
} from "@mi-pasaporte/domain/analytics/types";
const id = "11111111-1111-5111-8111-111111111111";
const row = (
  day: string,
  metric: string,
  count = 1,
  amountMinor = 100,
  dimensionId: string | null = null,
  locationId = "local",
  quantity = 1,
): AnalyticsMetric => ({
  day,
  metric,
  count,
  amountMinor,
  dimensionId,
  locationId,
  quantity,
  currencyCode: "USD",
  minorUnit: 2,
});
const input = (metrics: AnalyticsMetric[] = []): AnalyticsInput => ({
  today: "2026-10-20",
  metrics,
  firstSaleDays: [{ locationId: "local", day: "2026-09-22" }],
  locations: [
    { id: "local", name: "Centro" },
    { id: "other", name: "Norte" },
  ],
  labels: [{ kind: "customer", id, label: "Juan" }],
  currencyCode: "USD",
  minorUnit: 2,
});
const card = (i: AnalyticsInput, key: string) =>
  buildCustomerPromoCandidates(i).find((c) => c.cardKey === key);
describe("AN-3 cards", () => {
  it("10 requires 28 days, strict >3, and separates locations", () => {
    const i = input([row("2026-10-19", "voided_tickets", 3, 6400)]);
    expect(card(i, "10")).toBeUndefined();
    i.metrics = [...i.metrics, row("2026-10-19", "voided_tickets", 1, 100)];
    expect(card(i, "10")?.amountMinor).toBe(6500);
    expect(
      card(
        { ...i, firstSaleDays: [{ locationId: "local", day: "2026-09-23" }] },
        "10",
      ),
    ).toBeUndefined();
    expect(
      card(
        {
          ...i,
          metrics: i.metrics.map((r) => ({ ...r, locationId: "other" })),
        },
        "10",
      ),
    ).toBeUndefined();
  });
  it("10 uses eight prior disjoint weeks, population deviations, strict threshold", () => {
    const metrics = Array.from({ length: 8 }, (_, n) =>
      row(addDays("2026-10-20", -14 - 7 * n), "voided_tickets", 4),
    );
    metrics.push(row("2026-10-19", "voided_tickets", 4));
    expect(card(input(metrics), "10")).toBeUndefined();
    metrics[8]!.count = 5;
    expect(card(input(metrics), "10")).toBeDefined();
    metrics[0]!.count = 20;
    expect(card(input(metrics), "10")).toBeUndefined();
  });
  it("parks11 even for a formerly qualifying habitual while preserving cohort history", () => {
    const i = input(
      ["2026-08-19", "2026-08-31", "2026-09-12", "2026-09-24"].map((day) =>
        row(day, "visits", 1, 101, id),
      ),
    );
    expect(customerCohorts(i)[0]).toMatchObject({
      visitDays: 4,
      visits: 4,
      medianDays: 12,
      spentMinor: 404,
      lastDay: "2026-09-24",
    });
    for (const today of [
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-12-23",
      "2026-12-24",
    ])
      expect(card({ ...i, today }, "11")).toBeUndefined();
  });
  it("11 uses four distinct dates and averages spending per visited day", () => {
    const i = input([
      row("2026-09-01", "visits", 2, 200, id, "local", 2),
      row("2026-09-13", "visits", 1, 100, id),
      row("2026-09-25", "visits", 1, 100, id),
    ]);
    expect(customerCohorts(i)[0]).toMatchObject({
      visits: 4,
      visitDays: 3,
      medianDays: 12,
    });
    expect(card(i, "11")).toBeUndefined();
    const four = {
      ...i,
      metrics: [...i.metrics, row("2026-08-20", "visits", 1, 100, id)],
    };
    expect(card(four, "11")).toBeUndefined();
    expect(customerCohorts(four)[0]).toMatchObject({
      visitDays: 4,
      spentMinor: 500,
    });
    expect(
      card(input([row("2026-09-01", "visits", 4, 400, id, "local", 4)]), "11"),
    ).toBeUndefined();
  });
  it("11 merges visit dates and spending across the business and respects a recent visit anywhere", () => {
    const i = input([
      row("2026-08-20", "visits", 1, 100, id, "north"),
      row("2026-09-01", "visits", 1, 100, id),
      row("2026-09-13", "visits", 1, 100, id, "north"),
      row("2026-09-25", "visits", 1, 100, id),
      row("2026-09-25", "visits", 1, 100, id, "north"),
    ]);
    expect(card(i, "11")).toBeUndefined();
    expect(customerCohorts(i)[0]).toMatchObject({
      visitDays: 4,
      visits: 5,
      medianDays: 12,
    });
    expect(
      card(
        {
          ...i,
          metrics: [
            ...i.metrics,
            row("2026-10-19", "visits", 1, 100, id, "north"),
          ],
        },
        "11",
      ),
    ).toBeUndefined();
  });
  it("11 keeps known zero distinct from unknown money and COP integers exact", () => {
    const i = input(
      ["2026-08-19", "2026-08-31", "2026-09-12", "2026-09-24"].map((day) =>
        row(day, "visits", 1, 0, id),
      ),
    );
    expect(card(i, "11")).toBeUndefined();
    expect(customerCohorts(i)[0]).toMatchObject({
      spentMinor: 0,
      allAmountsKnown: true,
    });
    expect(
      customerCohorts({
        ...i,
        metrics: i.metrics.map((r) => ({ ...r, quantity: 0 })),
      })[0].allAmountsKnown,
    ).toBe(false);
    const cop = {
      ...i,
      currencyCode: "COP",
      minorUnit: 0,
      metrics: i.metrics.map((r) => ({
        ...r,
        currencyCode: "COP",
        minorUnit: 0,
        amountMinor: 101,
      })),
    };
    expect(card(cop, "11")).toBeUndefined();
    expect(customerCohorts(cop)[0].spentMinor).toBe(404);
  });
  it("12 occurs only next local day of earliest finish, uses snapshot window and no causal claim", () => {
    const i = {
      ...input([
        row("2026-10-19", "promo_discount", 1, 30, id),
        row("2026-10-19", "promo_sales", 1, 140, id),
        row("2026-09-01", "promo_sales", 1, 999, id),
      ]),
      campaigns: [
        {
          campaignId: id,
          label: "20%",
          status: "active",
          startsAt: "2026-10-01",
          endsAt: "2026-10-19",
          endedAt: null,
          capturedAt: "2026-10-01",
          eventId: id,
        },
      ],
    };
    expect(card(i, "12")).toMatchObject({
      amountMinor: 30,
      actionKey: "view_campaign_results",
    });
    expect(card(i, "12")?.body).toContain("no indican");
    expect(card({ ...i, today: "2026-10-19" }, "12")).toBeUndefined();
    expect(card({ ...i, today: "2026-10-21" }, "12")).toBeUndefined();
    expect(
      card(
        { ...i, campaigns: [{ ...i.campaigns[0]!, endsAt: "2026-10-22" }] },
        "12",
      ),
    ).toBeUndefined();
    expect(
      card(
        {
          ...i,
          campaigns: [
            { ...i.campaigns[0]!, endsAt: null, endedAt: "2026-10-19" },
          ],
        },
        "12",
      ),
    ).toBeDefined();
    expect(card({ ...i, metrics: [] }, "12")?.weight).toBeGreaterThan(0);
    expect(
      card(
        { ...i, campaigns: [{ ...i.campaigns[0]!, status: "draft" }] },
        "12",
      ),
    ).toBeUndefined();
  });
  it("history keeps selected period/local, distinct customers and nullable prize costs", () => {
    const i = input([
      row("2026-09-01", "visits", 1, 100, id),
      row("2026-10-19", "visits", 2, 200, id, "local", 2),
      row("2026-10-19", "visits", 1, 100, "other", "other"),
      row("2026-10-19", "promo_sales", 1, 140, id),
    ]);
    expect(
      summarizeCustomerPromoHistory(i, "2026-10-01", "2026-10-20", "local"),
    ).toMatchObject({
      customers: { count: 1, visits: 2, returning: 1 },
      promos: [{ salesMinor: 140, costMinor: null }],
    });
  });
  it("core detail actions enforce permission, exact opaque UUID and specific destinations", () => {
    const href = `/backoffice/customers/analytics/${id}`;
    expect(
      resolveAction(
        "view_customer",
        href,
        { role: "staff", permissions: ["analytics"] },
        new Set(),
      ),
    ).toBeNull();
    expect(
      resolveAction(
        "view_customer",
        href,
        { role: "staff", permissions: ["counter"] },
        new Set(),
      ),
    ).toEqual({ label: "Ver cliente", href });
    expect(
      resolveAction(
        "view_customer",
        href + "?consumerId=bad",
        { role: "owner", permissions: [] },
        new Set(),
      ),
    ).toBeNull();
  });
});
