import { buildCustomerPromoCandidates } from "../../../packages/domain/src/analytics/cards/customer-promo";
import path from "node:path";
import { defineConfig, type Page } from "@playwright/test";
import { analyticsInput, setupAnalytics } from "./analytics-fixture";
import { buildHistory } from "../../../packages/domain/src/analytics/history";
export { startAnalyticsHarness } from "./analytics-fixture";
export default defineConfig({
  testDir: "..",
  testMatch: ["analytics-an3.spec.ts"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: path.resolve("test-results/analytics-an3"),
  use: { browserName: "chromium", headless: true },
});
export async function setupCustomerPromoHistory(page: Page) {
  await setupAnalytics(page);
  const reads: string[] = [];
  const customer = "11111111-1111-5111-8111-111111111111";
  const campaign = "22222222-2222-4222-8222-222222222222";
  const metric = (
    day: string,
    metric: string,
    dimensionId: string,
    count: number,
    amountMinor: number,
    quantity = 0,
  ) => ({
    ...analyticsInput.metrics[0]!,
    day,
    metric,
    dimensionId,
    count,
    amountMinor,
    quantity,
  });
  const input = {
    ...analyticsInput,
    labels: [
      ...analyticsInput.labels,
      { kind: "campaign", id: campaign, label: "Café de la tarde" },
    ],
    metrics: [
      ...analyticsInput.metrics,
      metric("2026-09-01", "visits", customer, 1, 100, 1),
      metric("2026-10-19", "visits", customer, 4, 400, 4),
      metric("2026-10-19", "promo_discount", campaign, 1, 3000),
      metric("2026-10-19", "promo_sales", campaign, 1, 14000),
    ],
  };
  await page.route(/\/api\/analytics\/history\?/, (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    return route.fulfill({
      json: buildHistory(
        input,
        (url.searchParams.get("period") ?? "month") as "month",
        url.searchParams.get("locationId") || undefined,
      ),
    });
  });
  return { reads };
}

export async function setupCustomerPromoInbox(page: Page) {
  await setupAnalytics(page);
  const customer = "11111111-1111-5111-8111-111111111111",
    campaign = "22222222-2222-4222-8222-222222222222";
  const metric = (
    day: string,
    metric: string,
    count: number,
    amountMinor: number,
    dimensionId: string | null = null,
    quantity = 0,
  ) => ({
    ...analyticsInput.metrics[0]!,
    day,
    metric,
    count,
    amountMinor,
    dimensionId,
    quantity,
  });
  const input = {
    ...analyticsInput,
    firstSaleDays: [{ locationId: "local", day: "2026-09-01" }],
    labels: [{ kind: "customer", id: customer, label: "Juan" }],
    campaigns: [
      {
        campaignId: campaign,
        label: "Café de la tarde",
        status: "ended",
        startsAt: "2026-10-01",
        endsAt: "2026-10-19",
        endedAt: "2026-10-19",
        capturedAt: "2026-10-19",
        eventId: campaign,
      },
    ],
    metrics: [
      ...analyticsInput.metrics,
      metric("2026-10-19", "voided_tickets", 4, 6400),
      ...["2026-08-19", "2026-08-31", "2026-09-12", "2026-09-24"].map((day) =>
        metric(day, "visits", 1, 100, customer, 1),
      ),
      metric("2026-10-19", "promo_discount", 1, 3000, campaign),
      metric("2026-10-19", "promo_sales", 1, 14000, campaign),
    ],
  };
  let cards = buildCustomerPromoCandidates(input).map((c) => ({
    id: `card${c.cardKey}`,
    cardKey: c.cardKey,
    title: c.title,
    body: c.body,
    sender: c.sender,
    quality: c.quality,
    amountAtStake:
      c.amountMinor === null
        ? null
        : {
            amountMinor: c.amountMinor,
            currencyCode: c.currencyCode,
            minorUnit: c.minorUnit,
          },
    action: {
      label:
        c.cardKey === "10"
          ? "Ver anulados"
          : c.cardKey === "11"
            ? "Ver cliente"
            : "Ver resultados",
      href: c.actionHref ?? "/backoffice/sample?status=voided",
    },
  }));
  const writes: string[] = [];
  await page.route(/\/api\/analytics\/inbox(?:\/.*)?$/, (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().url());
      const id = route.request().url().split("/").at(-2);
      cards = cards.filter((c) => c.id !== id);
      return route.fulfill({ json: { cards } });
    }
    return route.fulfill({
      json: { state: "ready", preparedAt: "2026-10-20T08:00Z", cards },
    });
  });
  return { writes, customer };
}
