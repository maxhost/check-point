import { expect, test } from "@playwright/test";
import {
  setupSummary,
  startAnalyticsHarness,
} from "./support/finance-plan-fixture";
let harness: Awaited<ReturnType<typeof startAnalyticsHarness>>;
test.beforeAll(async () => {
  harness = await startAnalyticsHarness();
});
test.afterAll(async () => {
  await harness?.close();
});
test("summary distinguishes total objective, calendar average and today's genuine zero", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await setupSummary(page);
  await page.goto(harness.url);
  const summary = page.getByRole("region", {
    name: "Tus números de hoy",
    exact: true,
  });
  await expect(
    summary.getByText("Objetivo total estimado del mes", { exact: true }),
  ).toBeVisible();
  await expect(summary.getByText("$680,00", { exact: true })).toBeVisible();
  await expect(
    summary.getByText("Promedio diario del objetivo", { exact: true }),
  ).toBeVisible();
  await expect(summary.getByText("$21,94", { exact: true })).toBeVisible();
  await expect(summary.getByText("$0,00", { exact: true })).toBeVisible();
  await expect(
    summary.getByText(/31 días calendario del mes; no es una meta para hoy/),
  ).toBeVisible();
  expect(fixture.reads).toHaveLength(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/checkpass-0241-evidence/ui/summary-1440.png",
    fullPage: true,
  });
});
test("summary keeps unavailable numbers absent with a concise reason", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setupSummary(page, true);
  await page.goto(harness.url);
  const summary = page.getByRole("region", {
    name: "Tus números de hoy",
    exact: true,
  });
  await expect(summary.getByText(/Aún no podemos estimarlo/)).toBeVisible();
  await expect(summary.getByText("Pendiente", { exact: true })).toHaveCount(2);
  await expect(summary.getByText("$680,00", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/checkpass-0241-evidence/ui/summary-390.png",
    fullPage: true,
  });
});
