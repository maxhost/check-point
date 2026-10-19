import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { operationModules } from "./support/modules-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/counter-harness.tsx",
    "customers",
  );
});
test.afterAll(async () => {
  await harness.close();
});

for (const enabled of [true, false]) {
  for (const permissions of ["counter", "pos", "counter,pos"]) {
    test(`Clientes and authorized operation mobile links: enabled=${enabled} permissions=${permissions}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.route("**/api/merchant/session", (route) =>
        route.fulfill({ json: { authenticated: true } }),
      );
      await page.route("**/api/modules", (route) =>
        route.fulfill({ json: { modules: operationModules(enabled, false) } }),
      );
      await page.goto(
        `${harness.url}?mode=navigation&role=staff&permissions=${permissions}`,
      );
      await expect(page.locator(".backoffice-mobile-nav")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Mostrador", exact: true }),
      ).toHaveCount(0);
      await expect(
        page
          .locator(".backoffice-mobile-nav")
          .getByRole("link", { name: "POS", exact: true }),
      ).toHaveCount(enabled && permissions.includes("pos") ? 1 : 0);
      if (!enabled && permissions === "pos") {
        await expect(
          page
            .locator(".backoffice-mobile-nav")
            .getByRole("button", { name: "Administración", exact: true }),
        ).toHaveCount(0);
        return;
      }
      await page
        .locator(".backoffice-mobile-nav")
        .getByRole("button", { name: "Administración", exact: true })
        .click();
      const clients = page
        .getByRole("dialog", { name: "Menú" })
        .getByRole("link", { name: "Clientes", exact: true });
      await expect(clients).toHaveCount(
        permissions.includes("counter") ? 1 : 0,
      );
      if (permissions.includes("counter"))
        await expect(clients).toHaveAttribute("href", "/backoffice/customers");
    });
  }
}
