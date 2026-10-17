import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defineConfig, type Page } from "@playwright/test";
import { startCatalogHarness } from "./catalog-harness-server";
import { buildCandidates } from "../../../packages/domain/src/analytics/cards/index";
import {
  buildHistory,
  buildDay,
} from "../../../packages/domain/src/analytics/history";
import type {
  AnalyticsInput,
  InboxCard,
} from "../../../packages/domain/src/analytics/types";
export default defineConfig({
  testDir: "..",
  testMatch: ["analytics.spec.ts"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: path.resolve("test-results/analytics"),
  use: { browserName: "chromium", headless: true },
});
export async function startAnalyticsHarness() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "analytics-ui-"));
  const entry = path.join(directory, "entry.tsx");
  const inbox = path.resolve(
    "apps/merchant/src/app/backoffice/analytics/inbox.tsx",
  );
  const history = path.resolve(
    "apps/merchant/src/app/backoffice/analytics/analytics-console.tsx",
  );
  const nav = path.resolve(
    "apps/merchant/src/app/backoffice/backoffice-navigation.tsx",
  );
  await writeFile(
    entry,
    `import {createRoot} from 'react-dom/client';import {AnalyticsInbox} from ${JSON.stringify(inbox)};import History from ${JSON.stringify(history)};import {BackofficeNavigation} from ${JSON.stringify(nav)};const q=new URLSearchParams(location.search);createRoot(document.getElementById('root')).render(<div className="backoffice-layout"><BackofficeNavigation businessName="Café Centro" isOwner={true} permissions={['analytics','catalog','business']}/><div className="backoffice-content">{location.pathname.includes('/analytics')?<History initialDate={q.get('date')||''}/>:<main className="merchant-shell"><AnalyticsInbox/></main>}</div></div>);`,
  );
  try {
    const harness = await startCatalogHarness(entry, "analytics");
    return {
      ...harness,
      close: async () => {
        await harness.close();
        await rm(directory, { recursive: true });
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true });
    throw error;
  }
}
export const analyticsInput: AnalyticsInput = {
  today: "2026-10-20",
  currencyCode: "USD",
  minorUnit: 2,
  locations: [
    { id: "local", name: "Centro" },
    { id: "north", name: "Norte" },
  ],
  labels: [{ kind: "product", id: "coffee", label: "Café con leche" }],
  metrics: [
    {
      day: "2026-10-19",
      metric: "revenue",
      locationId: "local",
      dimensionId: null,
      amountMinor: 21000,
      quantity: 0,
      count: 34,
      currencyCode: "USD",
      minorUnit: 2,
    },
    {
      day: "2026-10-19",
      metric: "product_revenue",
      locationId: "local",
      dimensionId: "coffee",
      amountMinor: 21000,
      quantity: 0,
      count: 34,
      currencyCode: "USD",
      minorUnit: 2,
    },
    {
      day: "2026-10-19",
      metric: "units_sold",
      locationId: "local",
      dimensionId: "coffee",
      amountMinor: 0,
      quantity: 40,
      count: 0,
      currencyCode: "",
      minorUnit: 0,
    },
  ],
};
export async function setupAnalytics(page: Page) {
  const reads: string[] = [];
  const writes: string[] = [];
  const built = buildCandidates(analyticsInput);
  const candidates: InboxCard[] = built.map((c, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    cardKey: c.cardKey,
    sender: c.sender,
    title: c.title,
    body: c.body,
    amountAtStake:
      c.amountMinor === null
        ? null
        : {
            amountMinor: c.amountMinor,
            currencyCode: c.currencyCode,
            minorUnit: c.minorUnit,
          },
    quality: c.quality,
    action: c.actionKey
      ? {
          label: c.cardKey === "1" ? "Ver el día" : "Completar datos",
          href: c.actionHref ?? "/backoffice/analytics",
        }
      : null,
  }));
  const extra = Array.from({ length: 3 }, (_, i) => ({
    ...candidates[0]!,
    id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    title: `Aviso adicional ${i + 1}`,
    body: "Un aviso para revisar tus costos.",
    action: null,
    cardKey: "6",
  }));
  let cards = [...candidates, ...extra];
  await page.route("**/api/modules", (r) =>
    r.fulfill({ json: { modules: [] } }),
  );
  await page.route("**/api/merchant/session", (r) =>
    r.fulfill({
      json: {
        authenticated: true,
        business: { enabledModules: [] },
        membership: { role: "owner", permissions: ["analytics"] },
      },
    }),
  );
  await page.route(/\/api\/analytics\/inbox(?:\/.*)?$/, async (route) => {
    const url = route.request().url();
    if (route.request().method() === "POST") {
      writes.push(url);
      const id = url.split("/").at(-2);
      cards = cards.filter((c) => c.id !== id);
      return route.fulfill({ json: { cards: cards.slice(0, 5) } });
    }
    return route.fulfill({
      json: {
        state: "ready",
        preparedAt: "2026-10-20T08:00Z",
        cards: cards.slice(0, 5),
      },
    });
  });
  await page.route(/\/api\/analytics\/history\?/, (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    return route.fulfill({
      json: buildHistory(
        analyticsInput,
        (url.searchParams.get("period") ?? "month") as "month",
        url.searchParams.get("locationId") || undefined,
      ),
    });
  });
  await page.route(/\/api\/analytics\/day\?/, (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    return route.fulfill({
      json: buildDay(
        analyticsInput,
        url.searchParams.get("date") ?? "2026-10-19",
        url.searchParams.get("locationId") || undefined,
      ),
    });
  });
  return { reads, writes };
}
