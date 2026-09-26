import { expect, test } from "@playwright/test";
import { catalogApiFixture } from "./support/catalog-api-fixture";

const merchantURL = process.env.E2E_CATALOG_BASE_URL ?? "http://127.0.0.1:3001";
for (const role of ["owner", "staff"] as const) {
  const storageState =
    process.env[
      role === "owner"
        ? "E2E_CATALOG_OWNER_STORAGE_STATE"
        : "E2E_CATALOG_STAFF_STORAGE_STATE"
    ];
  test.describe(`catálogo autenticado como ${role}`, () => {
    test.use({ storageState, reducedMotion: "reduce" });
    test.skip(
      !storageState,
      "requiere sesión real de prueba y servidor merchant contra DB aislada; no sustituir el guard con page.route",
    );
    test("la página real aplica rol y publica el tour correspondiente", async ({
      page,
    }) => {
      const api = await catalogApiFixture(page);
      await page.goto(`${merchantURL}/backoffice/catalog?tour=onboarding`);
      await expect(
        page.getByRole("heading", { name: "Productos listos para vender" }),
      ).toBeVisible();
      if (role === "owner") {
        await expect(page.locator(".driver-popover-title")).toHaveText(
          "Cargá tu menú con IA",
        );
        await page.getByRole("button", { name: "Saltar tour" }).click();
        expect(api.progress).toEqual(["skipped"]);
      } else {
        await page.getByRole("button", { name: "Ayuda", exact: true }).click();
        await expect(
          page.getByRole("button", { name: /Eliminar un producto/ }),
        ).toBeDisabled();
        expect(api.progress).toEqual([]);
      }
    });
  });
}
