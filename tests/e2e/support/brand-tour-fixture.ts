import { test as base, expect, type Page } from "@playwright/test";
import { startCatalogHarness } from "./catalog-harness-server";
import type { Brand } from "../../../apps/merchant/src/app/backoffice/brand/brand-api";
export const test = base.extend<object, { brandHarness: string }>({
  brandHarness: [
    async ({ browserName }, use) => {
      void browserName;
      const harness = await startCatalogHarness(
        "tests/e2e/support/brand-harness.tsx",
      );
      try {
        await use(harness.url);
      } finally {
        await harness.close();
      }
    },
    { scope: "worker" },
  ],
});
export const title = (page: Page) => page.locator(".driver-popover-title");
export const next = (page: Page) =>
  page.locator(".driver-popover-next-btn").click();
export async function help(page: Page, name: string) {
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  await page
    .getByRole("dialog", { name: "¿Qué querés hacer?" })
    .getByRole("button", { name })
    .click();
  await expect(page.locator(".driver-popover")).toBeVisible();
}
export async function brandFixture(page: Page) {
  const api = {
    brand: {
      id: "brand-1",
      name: "Café Inicial",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
      brandPrimaryColor: "#123ABC",
      brandComplementaryColor: "#BADA55",
      brandAccentColor: "#F0F0F0",
      brandRevision: 1,
      logoVersion: 0,
      logoPath: null,
    } as Brand,
    writes: [] as Record<string, unknown>[],
    progress: [] as string[],
    reads: 0,
    uploads: 0,
    failGet: 0,
    failPut: 0,
    failProgress: false,
    failUpload: 0,
    holdPut: null as Promise<void> | null,
  };
  await page.route("**/api/onboarding/checklist", (route) =>
    route.fulfill({
      json: {
        locale: "es",
        items: [
          {
            id: "verify-email",
            anchor: "verify-email",
            position: 1,
            required: true,
            done: true,
            title: "Email",
            body: "Email",
          },
          {
            id: "brand",
            anchor: "brand",
            position: 6,
            required: false,
            done: api.progress.length > 0,
            title: "Marca",
            body: "Revisá tu marca",
          },
        ],
      },
    }),
  );
  await page.route("**/api/onboarding/tours/brand", (route) => {
    if (api.failProgress)
      return route.fulfill({
        status: 503,
        json: {
          error: "No pudimos guardar tu progreso.",
          code: "onboarding_unavailable",
        },
      });
    api.progress.push(route.request().postDataJSON().status);
    return route.fulfill({ json: route.request().postDataJSON() });
  });
  await page.route("**/api/brand", async (route) => {
    if (route.request().method() === "GET") {
      api.reads++;
      return route.fulfill(
        api.failGet
          ? { status: api.failGet, json: { error: "Lectura rechazada." } }
          : { json: api.brand },
      );
    }
    const input = route.request().postDataJSON();
    api.writes.push(input);
    if (api.holdPut) await api.holdPut;
    if (api.failPut)
      return route.fulfill({
        status: api.failPut,
        json: { error: "No pudimos aplicar esos cambios." },
      });
    api.brand = {
      ...api.brand,
      ...input,
      name: input.name.trim().replace(/\s+/g, " "),
      brandRevision: api.brand.brandRevision + 1,
      logoPath:
        input.logoAction === "remove"
          ? null
          : input.logoAction === "replace"
            ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
            : api.brand.logoPath,
    };
    return route.fulfill({ json: api.brand });
  });
  await page.route("**/api/brand/logo-upload", (route) => {
    api.uploads++;
    return route.fulfill(
      api.failUpload
        ? {
            status: api.failUpload,
            json: { error: "No pudimos preparar el logo." },
          }
        : {
            status: 201,
            json: {
              uploadId: `upload-${api.uploads}`,
              uploadUrl: new URL("/asset-upload", route.request().url()).href,
              expiresAt: "2099-01-01",
            },
          },
    );
  });
  await page.route("**/asset-upload", (route) =>
    route.fulfill({ status: 200 }),
  );
  return api;
}
