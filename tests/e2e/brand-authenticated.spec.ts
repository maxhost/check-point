import { expect, test } from "@playwright/test";
import { brandFixture } from "./support/brand-tour-fixture";
const merchantURL = process.env.E2E_BRAND_BASE_URL ?? "http://127.0.0.1:3001";
for (const role of ["owner", "staff"] as const) {
  const storageState =
    process.env[
      role === "owner"
        ? "E2E_BRAND_OWNER_STORAGE_STATE"
        : "E2E_BRAND_STAFF_STORAGE_STATE"
    ];
  test.describe(`Marca autenticada ${role}`, () => {
    test.use({ storageState, reducedMotion: "reduce" });
    test.skip(
      !storageState,
      "requiere sesión real owner/staff con brand en merchant contra DB aislada; no suplantar guard server-side",
    );
    test("página real conserva rol, ayuda y onboarding", async ({ page }) => {
      const api = await brandFixture(page);
      await page.goto(`${merchantURL}/backoffice/brand?tour=onboarding`);
      await expect(
        page.getByRole("heading", { name: "La identidad de tu negocio" }),
      ).toBeVisible();
      if (role === "owner") {
        await expect(page.locator(".driver-popover-title")).toHaveText(
          "Dale identidad a tu negocio",
        );
        await page.getByRole("button", { name: "Saltar tour" }).click();
        await expect.poll(() => api.progress).toEqual(["skipped"]);
      } else {
        await expect(
          page.getByRole("link", { name: "Crear afiche" }),
        ).toHaveCount(0);
        await page.getByRole("button", { name: "Ayuda", exact: true }).click();
        await expect(
          page.getByRole("dialog", { name: "¿Qué querés hacer?" }),
        ).toBeVisible();
        expect(api.progress).toEqual([]);
      }
    });
  });
}
