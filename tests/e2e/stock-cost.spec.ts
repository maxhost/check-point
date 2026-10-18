import { expect, test } from "@playwright/test";
import {
  setupStockCosts,
  startAnalyticsHarness,
  stockCosts,
} from "./support/stock-cost-fixture";
let harness: Awaited<ReturnType<typeof startAnalyticsHarness>>;
test.beforeAll(async () => {
  harness = await startAnalyticsHarness();
});
test.afterAll(async () => {
  await harness?.close();
});

for (const width of [390, 1440]) {
  test(`cost selection, exact records and honest sparse chart at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await setupStockCosts(page);
    await page.goto(`${harness.url}/backoffice/analytics`);
    const card = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Stock e insumos",
        exact: true,
      }),
    });
    await expect(
      card.getByText("Falta conocer el costo de 1 insumo", { exact: false }),
    ).toContainText("Falta conocer el costo de 1 insumo");
    await expect(card.getByRole("img")).toHaveAccessibleName(
      /Costos registrados de Harina de trigo/,
    );
    const firstNode = card.getByRole("button", {
      name: "30 sept 2026 · 0,001 USD/g · Anterior al período",
      exact: true,
    });
    await firstNode.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      "30 sept 2026 · 0,001 USD/g · Anterior al período",
    );
    await page.mouse.move(0, 0);
    await firstNode.focus();
    await expect(page.getByRole("tooltip")).toHaveText(
      "30 sept 2026 · 0,001 USD/g · Anterior al período",
    );
    await page.keyboard.press("Escape");
    await card
      .getByRole("button", { name: "5 oct 2026 · 0,00125 USD/g", exact: true })
      .click();
    await expect(page.getByRole("tooltip")).toHaveText(
      "5 oct 2026 · 0,00125 USD/g",
    );
    await page.keyboard.press("Escape");
    await expect(
      card.getByRole("button", { name: /Ver registros/ }),
    ).toHaveCount(0);
    const reads = fixture.reads.length;
    await card.getByRole("button", { name: /Insumo y local/ }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(card.getByText("Mín. 0 USD/g", { exact: true })).toBeVisible();
    await expect(card.getByRole("img")).toHaveAccessibleName(
      /Costos registrados de Harina · Norte/,
    );
    const paths = await card.locator("svg path").last().getAttribute("d");
    expect(paths).toMatch(/M16,110 L624,110/);
    expect(fixture.reads).toHaveLength(reads);
    await page.getByRole("button", { name: /Período/ }).click();
    await page.getByRole("option", { name: "3 meses", exact: true }).click();
    await expect(
      card.getByRole("button", { name: /Insumo y local/ }),
    ).toContainText("Harina · Norte");
    await page.getByRole("button", { name: /Local/ }).click();
    await page.getByRole("option", { name: "Centro", exact: true }).click();
    await expect(
      card.getByRole("button", { name: /Insumo y local/ }),
    ).toContainText("Harina de trigo");
    await card.getByRole("button", { name: /Insumo y local/ }).click();
    await page
      .getByRole("option", { name: "Leche · Centro", exact: true })
      .click();
    await expect(
      card.getByText(/Un registro; falta otro costo para ver la evolución/),
    ).toBeVisible();
    await expect(card.getByText(/0,002 USD\/ml/)).toBeVisible();
    await expect(card.getByRole("img")).toHaveCount(0);
    await expect(
      card.getByText("Conjunto de insumos · este período", { exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: /Insumo y local/ }).click();
    await page.getByRole("option", { name: /Harina de trigo/ }).click();
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `/private/tmp/checkpass-0240-evidence/nodes/stock-${width}.png`,
      fullPage: true,
    });
    const overflow = await page.evaluate(() => ({
      width: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")]
        .filter(
          (element) =>
            element.getBoundingClientRect().right > window.innerWidth + 1,
        )
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          classes: element.className,
          right: element.getBoundingClientRect().right,
        })),
    }));
    expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width,
    );
  });
}

test("empty series never fabricates a graph or a zero cost", async ({
  page,
}) => {
  await setupStockCosts(page, {
    ...stockCosts,
    series: [],
    defaultSeriesId: null,
  });
  await page.goto(`${harness.url}/backoffice/analytics`);
  const card = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Stock e insumos", exact: true }),
  });
  await expect(
    card.getByText(
      "Todavía no hay costos registrados para este período y local.",
    ),
  ).toBeVisible();
  await expect(card.getByRole("img")).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: /Insumo y local/ }),
  ).toHaveCount(0);
});
