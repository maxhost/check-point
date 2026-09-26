import { test as base, expect } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { brandFixture } from "./support/brand-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";
const test = base.extend<{ harness: string }>({
  harness: async ({ browserName }, use) => {
    void browserName;
    const server = await startCatalogHarness(
      "tests/e2e/support/loyalty-regression-entry.tsx",
    );
    try {
      await use(server.url);
    } finally {
      await server.close();
    }
  },
});
for (const theme of ["light", "dark"] as const)
  test(`CSS final otras superficies ${theme}`, async ({
    page,
    harness,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await brandFixture(page);
    await page.goto(`${harness}?surface=brand`);
    await expect(
      page.getByRole("textbox", { name: "Nombre del negocio" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`brand-${theme}.png`),
      fullPage: true,
    });
    await page.unroute("**/api/**");
    await catalogApiFixture(page);
    await page.goto(`${harness}?surface=catalog`);
    await expect(
      page.getByRole("button", { name: "Importar con IA" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`catalog-${theme}.png`),
      fullPage: true,
    });
    await page.unroute("**/api/**");
    await page.route("**/api/**", (route) =>
      route.fulfill({
        json:
          new URL(route.request().url()).pathname === "/api/merchant/session"
            ? {
                authenticated: true,
                user: { id: "owner" },
                membership: { role: "owner", permissions: ["staff"] },
              }
            : { staff: [] },
      }),
    );
    await page.goto(`${harness}?surface=staff`);
    await page.getByRole("button", { name: /Añadir integrante/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Nombre", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`staff-${theme}.png`),
      fullPage: true,
    });
    await page.goto(`${harness}?surface=locations`);
    await page.getByRole("button", { name: /Añadir local/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Nombre del local" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`locations-${theme}.png`),
      fullPage: true,
    });
  });
