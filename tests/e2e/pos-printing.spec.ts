import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { operationModules } from "./support/modules-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-counter-harness.tsx",
    "settings",
  );
});
test.afterAll(async () => {
  await harness.close();
});

for (const owner of [true, false]) {
  test(`ticket settings use scoped V2; owner=${owner}; no module activation`, async ({
    page,
  }) => {
    const calls: { path: string; method: string; body: unknown }[] = [];
    let settings = {
      printingEnabled: false,
      showBusinessName: true,
      showTable: true,
    };
    await page.route("**/api/**", (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (path === "/api/merchant/session")
        return route.fulfill({ json: { authenticated: true } });
      if (path === "/api/modules")
        return route.fulfill({
          json: { modules: operationModules(true, false) },
        });
      calls.push({
        path,
        method: req.method(),
        body: req.postData() ? req.postDataJSON() : null,
      });
      expect(req.headers()["x-pos-contract"]).toBe("2");
      expect(req.headers()["x-backoffice-scope"]).toBe("a".repeat(64));
      if (!owner)
        return route.fulfill({
          status: 403,
          json: {
            code: "owner_required",
            error: "Solo la persona propietaria puede configurar el ticket.",
          },
        });
      if (req.method() === "PUT") settings = req.postDataJSON();
      return route.fulfill({ json: settings });
    });
    await page.goto(
      `${harness.url}?mode=settings&role=${owner ? "owner" : "staff"}`,
    );
    if (owner) {
      const control = page.getByRole("switch", {
        name: "Imprimir tickets",
        exact: true,
      });
      await expect(control).not.toBeChecked();
      expect(calls.every((call) => call.method === "GET")).toBe(true);
      await control.focus();
      await page.keyboard.press("Space");
      await expect(control).toBeChecked();
      expect(calls).toEqual([
        { path: "/api/modules/pos/ticket-settings", method: "GET", body: null },
        {
          path: "/api/modules/pos/ticket-settings",
          method: "PUT",
          body: {
            printingEnabled: true,
            showBusinessName: true,
            showTable: true,
          },
        },
      ]);
    } else {
      await expect(
        page.getByRole("switch", { name: "Imprimir tickets", exact: true }),
      ).toHaveCount(0);
      expect(calls.every((call) => call.method === "GET")).toBe(true);
    }
    expect(calls.some((call) => call.path === "/api/modules/pos")).toBe(false);
  });
}

for (const enabled of [true, false]) {
  test(`staff creation recommendation follows active operation enabled=${enabled}`, async ({
    page,
  }) => {
    await page.route("**/api/merchant/session", (route) =>
      route.fulfill({ json: { authenticated: true } }),
    );
    await page.route("**/api/modules", (route) =>
      route.fulfill({ json: { modules: operationModules(enabled, false) } }),
    );
    await page.goto(
      `${harness.url}?mode=permissions-${enabled ? "on" : "off"}`,
    );
    await expect(
      page.getByRole("switch", { name: "Clientes", exact: true }),
    ).toBeChecked({ checked: !enabled });
    await expect(
      page.getByRole("switch", { name: "POS", exact: true }),
    ).toBeChecked({ checked: enabled });
    if (!enabled)
      await expect(
        page.getByRole("switch", { name: "POS", exact: true }),
      ).toBeDisabled();
    await expect(
      page.getByRole("switch", { name: "Mostrador", exact: true }),
    ).toHaveCount(0);
  });
}
