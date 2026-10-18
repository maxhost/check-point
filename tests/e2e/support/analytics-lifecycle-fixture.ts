import path from "node:path";
import { defineConfig, type Page } from "@playwright/test";
import type { InboxCard } from "../../../packages/domain/src/analytics/types";
export { startAnalyticsHarness } from "./analytics-fixture";

export default defineConfig({
  testDir: "..",
  testMatch: ["analytics-lifecycle.spec.ts"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: path.resolve("test-results/analytics-lifecycle"),
  use: {
    browserName: "chromium",
    headless: true,
    timezoneId: "Pacific/Honolulu",
  },
});

/** Sample HTTP fixtures, not a second product catalog. The server owns capabilities. */
export function withLifecycle(
  card: Omit<
    InboxCard,
    "version" | "category" | "expiresAt" | "period" | "decisions"
  >,
  category: "informational" | "actionable",
) {
  return {
    ...card,
    version: `context-${card.id}-1`,
    category,
    expiresAt: "2027-01-18T15:00:00.000Z",
    period: {
      from: "2026-10-19",
      to: "2026-10-19",
      label: "19 de octubre de 2026",
    },
    decisions:
      category === "informational"
        ? [
            { key: "seen" as const, label: "Visto" },
            { key: "ignore" as const, label: "Ignorar" },
          ]
        : [
            { key: "resolve" as const, label: "Solucionado" },
            { key: "ignore" as const, label: "Ignorar" },
            { key: "snooze" as const, label: "Recordarme luego" },
          ],
  };
}

export function lifecycleEnvelope(cards: ReturnType<typeof withLifecycle>[]) {
  return {
    contractVersion: 2 as const,
    policyVersion: "fixture-policy-v2",
    timezone: "America/Guayaquil",
    state: "ready" as "ready" | "preparing",
    preparedAt: "2026-10-20T15:00:00.000Z",
    nextReminderAt: null as string | null,
    refreshAfterMs: null as number | null,
    cards,
  };
}

export async function setupLifecycle(page: Page) {
  const informative = withLifecycle(
    {
      id: "00000000-0000-4000-8000-000000000001",
      cardKey: "1",
      sender: "Ventas",
      title: "Tus ventas de ayer",
      body: "Ayer vendiste $1000 en 34 tickets.",
      amountAtStake: null,
      quality: "observed",
      action: {
        label: "Ver el día",
        href: "/backoffice/analytics?date=2026-10-19",
      },
    },
    "informational",
  );
  const actionable = withLifecycle(
    {
      id: "00000000-0000-4000-8000-000000000008",
      cardKey: "8",
      sender: "Stock",
      title: "Queda poca harina",
      body: "Te queda 1 kg de harina: alcanza para entre 1 y 2 días.",
      amountAtStake: null,
      quality: "estimated",
      action: { label: "Registrar compra", href: "/backoffice/catalog" },
    },
    "actionable",
  );
  const fixture = {
    inbox: lifecycleEnvelope([informative, actionable]),
    summary: {
      version: 1,
      date: "2026-10-20",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
      minorUnit: 2,
      readAt: "2026-10-20T15:00:00Z",
      monthBreakEvenMinor: 310000,
      dailyBreakEvenMinor: 10000,
      todayRevenueMinor: 45600,
      estimated: true,
      unavailableReason: null,
    },
    summaryReads: 0,
    holdSummary: null as Promise<void> | null,
    summaryError: null as {
      status: number;
      code: string;
      error: string;
    } | null,
    reads: 0,
    holdRead: null as Promise<void> | null,
    holdWrite: null as Promise<void> | null,
    nextTransportFailure: false,
    writes: [] as { decision: string; body: Record<string, unknown> }[],
    nextError: null as { status: number; code: string; error: string } | null,
  };
  await page.route("**/api/analytics/summary", async (route) => {
    fixture.summaryReads++;
    const snapshot = structuredClone(fixture.summary);
    await fixture.holdSummary;
    if (fixture.summaryError)
      return route.fulfill({
        status: fixture.summaryError.status,
        json: fixture.summaryError,
      });
    return route.fulfill({ json: snapshot });
  });
  await page.route(/\/api\/analytics\/inbox(?:\/.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      fixture.reads += 1;
      const snapshot = structuredClone(fixture.inbox);
      await fixture.holdRead;
      return route.fulfill({ json: snapshot });
    }
    const parts = new URL(request.url()).pathname.split("/");
    const id = parts.at(-2);
    const decision = parts.at(-1)!;
    const body = request.postDataJSON() as Record<string, unknown>;
    fixture.writes.push({ decision, body });
    if (fixture.nextTransportFailure) {
      fixture.nextTransportFailure = false;
      return route.abort("failed");
    }
    await fixture.holdWrite;
    if (fixture.nextError) {
      const failure = fixture.nextError;
      fixture.nextError = null;
      return route.fulfill({ status: failure.status, json: failure });
    }
    fixture.inbox.cards = fixture.inbox.cards.filter((card) => card.id !== id);
    if (decision === "snooze")
      fixture.inbox.nextReminderAt = String(body.remindAt);
    return route.fulfill({
      json: {
        cards: fixture.inbox.cards,
        nextReminderAt: fixture.inbox.nextReminderAt,
      },
    });
  });
  return { fixture, informative, actionable };
}
