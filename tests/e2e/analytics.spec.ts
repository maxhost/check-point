import { expect, test } from "@playwright/test";
import {
  setupAnalytics,
  startAnalyticsHarness,
} from "./support/analytics-fixture";
let harness: Awaited<ReturnType<typeof startAnalyticsHarness>>;
test.beforeAll(async () => {
  harness = await startAnalyticsHarness();
});
test.afterAll(async () => {
  await harness.close();
});
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
])
  test(`Dashboard inbox accepts, navigates and replaces dismissed cards at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const fixture = await setupAnalytics(page);
    await page.goto(harness.url);
    await expect(
      page.getByRole("heading", { name: "Hoy en tu negocio" }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(5);
    await expect(page.getByText(/Ayer vendiste/)).toHaveCount(1);
    await page
      .getByRole("button", { name: "Descartar Falta conocer tus costos" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Aviso adicional 2" }),
    ).toBeVisible();
    expect(fixture.writes).toHaveLength(1);
    await page
      .getByRole("button", { name: "Ver el día", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/backoffice\/analytics\?date=2026-10-19/);
    await expect(
      page.getByText("El 2026-10-19 vendiste", { exact: false }),
    ).toBeVisible();
    expect(fixture.writes.some((url) => url.endsWith("/accept"))).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/analytics/history-${viewport.width}.png`,
      fullPage: true,
    });
  });
test("history has five periods and local filter, suppresses incomplete annual comparison", async ({
  page,
}) => {
  const fixture = await setupAnalytics(page);
  await page.goto(`${harness.url}/backoffice/analytics`);
  await expect(
    page.getByRole("heading", { name: "Ventas del período" }),
  ).toBeVisible();
  for (const label of [
    "3 meses",
    "6 meses",
    "9 meses",
    "12 meses",
    "Mes en curso",
  ]) {
    await page.getByRole("button", { name: /Período/ }).click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ventas del período" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Norte", exact: true }).click();
  await expect
    .poll(() => fixture.reads.some((q) => q.includes("locationId=north")))
    .toBe(true);
  await expect(
    page.getByText("En el mismo período del año anterior", { exact: false }),
  ).toHaveCount(0);
});

test("after dismissing every card, historical business has no new-business invitation", async ({
  page,
}) => {
  const fixture = await setupAnalytics(page);
  await page.goto(harness.url);
  await expect(page.getByRole("article")).toHaveCount(5);
  while (await page.getByRole("button", { name: /^Descartar / }).count()) {
    const writes = fixture.writes.length;
    await page
      .getByRole("button", { name: /^Descartar / })
      .first()
      .click();
    await expect.poll(() => fixture.writes.length).toBe(writes + 1);
    await expect(
      page
        .getByRole("button", { name: /^Descartar / })
        .and(page.getByRole("button", { disabled: true })),
    ).toHaveCount(0);
  }
  await expect(
    page.getByText("Hoy no tengo nada para avisarte."),
  ).toBeVisible();
  await expect(page.getByText(/empieza a contar|desde hoy/)).toHaveCount(0);
});
