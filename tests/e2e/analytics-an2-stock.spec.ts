import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { chooseLocal, stockLocalFixture } from "./support/stock-local-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/modules-ui-harness.tsx",
    "stock",
  );
});
test.afterAll(async () => {
  await harness?.close();
});
for (const width of [390, 1280])
  test(`count deep link loads exact count outside log in selected local (${width})`, async ({
    page,
  }, info) => {
    await stockLocalFixture(page);
    await page.setViewportSize({ width, height: 900 });
    const detailReads: string[] = [];
    await page.route("**/api/modules/stock/counts/old-count?*", (route) => {
      detailReads.push(
        new URL(route.request().url()).searchParams.get("locationId") ?? "",
      );
      return route.fulfill({
        json: {
          movement: {
            id: "old-count",
            itemId: "flour",
            itemName: "Harina",
            unit: "g",
            kind: "adjustment",
            quantity: "-3000.000",
            countedQuantity: "17000.000",
            theoreticalQuantity: "20000.000",
            totalCost: null,
            createdAt: "2026-10-15T15:00:00Z",
            occurredAt: "2026-10-15T15:00:00Z",
          },
        },
      });
    });
    await page.goto(
      `${harness.url}/backoffice/stock?surface=stock&movementId=old-count&locationId=second`,
    );
    await expect(
      page.getByText("Conteo de Harina", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Contaste 17.000 g. El stock teórico era 20.000. Diferencia: -3000.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(detailReads).toEqual(["second"]);
    await expect(
      page.getByText("Consumo · Harina", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`count-detail-${width}.png`),
      fullPage: true,
    });
    await chooseLocal(page, "Centro");
    await expect(
      page.getByText("Conteo de Harina", { exact: true }),
    ).toHaveCount(0);
  });
test("missing count surfaces recoverable error without fabricating detail", async ({
  page,
}) => {
  await stockLocalFixture(page);
  await page.route("**/api/modules/stock/counts/missing?*", (route) =>
    route.fulfill({
      status: 404,
      json: { error: "Ese conteo no existe.", code: "count_not_found" },
    }),
  );
  await page.goto(
    `${harness.url}/backoffice/stock?surface=stock&movementId=missing&locationId=second`,
  );
  await expect(
    page.getByText("Ese conteo no existe.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Conteo de Harina", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Reintentar registro", exact: true }),
  ).toBeVisible();
});
