import { expect, test, type Page } from "@playwright/test";
import {
  setupFinancePlan,
  startAnalyticsHarness,
} from "./support/finance-plan-fixture";
let harness: Awaited<ReturnType<typeof startAnalyticsHarness>>;
test.beforeAll(async () => {
  harness = await startAnalyticsHarness();
});
test.afterAll(async () => {
  await harness?.close();
});
const plan = (page: Page) => page.locator("#calculo");

for (const width of [390, 1440])
  test(`monthly plan keeps its window, detail and movements at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await setupFinancePlan(page);
    await page.goto(`${harness.url}/backoffice/analytics`);
    const card = plan(page);
    await expect(
      card.getByRole("heading", { name: "Para cubrir los gastos del mes" }),
    ).toBeVisible();
    await expect(
      card.getByText("octubre de 2026 · Corte al 20 oct 2026"),
    ).toBeVisible();
    await expect(
      card.getByText("Te falta vender", { exact: true }),
    ).toBeVisible();
    await expect(card.getByText("$280,00", { exact: true })).toHaveCount(2);
    await expect(card.getByText("$400,00", { exact: true })).toBeVisible();
    await expect(card.getByText("$510,00", { exact: true })).toBeVisible();
    await expect(card.getByText("$680,00", { exact: true })).toHaveCount(0);
    const reads = fixture.reads.length;
    await card
      .getByRole("button", { name: "Ver detalle de gastos", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const detail = card.getByRole("list", {
      name: "Detalle de gastos del mes",
    });
    await expect(detail.getByRole("listitem")).toHaveCount(2);
    await expect(
      detail.getByText("1 mes con registros", { exact: false }),
    ).toBeVisible();
    await expect(
      detail.getByText("2 meses con registros", { exact: false }),
    ).toBeVisible();
    const rent = detail
      .getByRole("listitem")
      .filter({ hasText: "Alquiler del local" });
    await expect(rent).toContainText("$200,00");
    await expect(rent).toContainText("$450,00");
    await expect(rent).toContainText("$250,00");
    expect(fixture.reads).toHaveLength(reads);
    await expect(
      card.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByText("Pago parcial de alquiler", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(detail).toHaveCount(0);
    await page.getByRole("button", { name: /Período/ }).click();
    await page.getByRole("option", { name: "3 meses", exact: true }).click();
    await expect
      .poll(() => fixture.reads.some((q) => q.includes("period=3m")))
      .toBe(true);
    await expect(
      card.getByText("octubre de 2026 · Corte al 20 oct 2026"),
    ).toBeVisible();
    await expect(card.getByText("$280,00", { exact: true })).toHaveCount(2);
    const expenses = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Gastos", exact: true }),
      })
      .last();
    await expect(
      expenses.getByText("Gastos pagados", { exact: true }),
    ).toBeVisible();
    await expect(expenses).toContainText("1 ago 2026");
    await expect(expenses).toContainText("$700,00");
    await card.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/private/tmp/checkpass-0241-evidence/ui/plan-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Local/ }).click();
    await page.getByRole("option", { name: "Norte", exact: true }).click();
    await expect(
      card.getByText("Aún no podemos estimarlo", { exact: true }),
    ).toBeVisible();
    await expect(
      card.getByText("Faltan referencias de gastos para completar el mes."),
    ).toBeVisible();
    await expect(
      card.getByText("Te falta vender", { exact: true }),
    ).toHaveCount(0);
    await expect(
      card.getByText("Sin estimación", { exact: true }),
    ).toBeVisible();
    await card
      .getByRole("button", { name: "Ver detalle de gastos", exact: true })
      .click();
    const missing = card
      .getByRole("listitem")
      .filter({ hasText: "Equipo nuevo sin referencia histórica" });
    await expect(missing).toContainText("$90,00");
    await expect(missing).toContainText("Sin meses de referencia");
    await expect(
      missing.getByText("Sin referencia", { exact: true }),
    ).toHaveCount(2);
    await expect(missing.getByText("$0,00", { exact: true })).toHaveCount(0);
  });

test("unknown sales costs with a known expense forecast never publishes remaining sales", async ({
  page,
}) => {
  await setupFinancePlan(page, "unavailable");
  await page.goto(`${harness.url}/backoffice/analytics`);
  const card = plan(page);
  await expect(
    card.getByText("Aún no podemos estimarlo", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByText(
      "Falta completar los costos y las comisiones de tus ventas.",
    ),
  ).toBeVisible();
  await expect(card.getByText("$510,00", { exact: true })).toBeVisible();
  await expect(card.getByText("Te falta vender", { exact: true })).toHaveCount(
    0,
  );
  await expect(card.getByText("$680,23", { exact: true })).toHaveCount(0);
  await expect(card.getByText(/80%|9,49%/)).toHaveCount(0);
});

test("covered forecast keeps genuine zero distinct from missing references", async ({
  page,
}) => {
  await setupFinancePlan(page, "covered");
  await page.goto(`${harness.url}/backoffice/analytics`);
  const card = plan(page);
  await expect(card.getByText("$0,00", { exact: true })).toHaveCount(2);
  await expect(
    card.getByText(/Tus ventas ya cubren los gastos previstos/),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Ver detalle de gastos", exact: true })
    .click();
  await expect(
    card
      .getByRole("list", { name: "Detalle de gastos del mes" })
      .getByText("$0,00", { exact: true }),
  ).toHaveCount(2);
  await expect(card.getByText("Sin referencia", { exact: true })).toHaveCount(
    0,
  );
});

test("missing finance payload uses explicit unavailable fallback", async ({
  page,
}) => {
  await setupFinancePlan(page, "estimated", true);
  await page.goto(`${harness.url}/backoffice/analytics`);
  const card = plan(page);
  await expect(
    card.getByText("Aún no podemos estimarlo", { exact: true }),
  ).toBeVisible();
  await expect(card.getByText("Te falta vender", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    card.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
});
