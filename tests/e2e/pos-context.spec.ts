import { test, expect, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-context-fixture.tsx",
    "pos",
  );
});
test.afterAll(async () => {
  await harness?.close();
});
async function setup(page: Page, loading = false) {
  const requests: { path: string; scope: string | undefined }[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push({
      path,
      scope: route.request().headers()["x-backoffice-scope"],
    });
    await route.fulfill({
      json: path.endsWith("/orders")
        ? { open: [], closedToday: [] }
        : path.endsWith("/catalog")
          ? { products: [], categories: [], bestSellingProductIds: [] }
          : { printingEnabled: false, showBusinessName: true, showTable: true },
    });
  });
  await page.goto(harness.url + (loading ? "?loading" : ""));
  return requests;
}
test("ready seed uses no session/modules GET and one scoped list; withdrawal has no legacy fallback", async ({
  page,
}) => {
  const requests = await setup(page);
  await expect(
    page.getByRole("button", { name: "Nueva orden", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => requests.filter((r) => r.path.endsWith("/orders")).length)
    .toBe(1);
  expect(requests.every((r) => r.scope === "a".repeat(64))).toBe(true);
  expect(requests.some((r) => /session|\/modules$/.test(r.path))).toBe(false);
  await page.getByRole("button", { name: "Retirar ámbito" }).click();
  await expect(
    page.getByRole("button", { name: "Nueva orden", exact: true }),
  ).toHaveCount(0);
  const count = requests.length;
  await page.waitForTimeout(100);
  expect(requests).toHaveLength(count);
});
test("loading modules do not invent permission or start requests", async ({
  page,
}) => {
  const requests = await setup(page, true);
  await page.waitForTimeout(150);
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Entregar módulos" }).click();
  await expect
    .poll(() => requests.filter((r) => r.path.endsWith("/orders")).length)
    .toBe(1);
});
test("scope409 settings write retires shared presentation without retry", async ({
  page,
}) => {
  const requests = await setup(page);
  await expect(
    page.getByRole("switch", { name: "Imprimir tickets", exact: true }),
  ).toBeEnabled();
  let writes = 0;
  await page.route("**/api/modules/pos/ticket-settings", async (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      await route.fulfill({
        status: 409,
        json: {
          code: "backoffice_context_changed",
          error: "Tu sesión cambió.",
        },
      });
    } else
      await route.fulfill({
        json: {
          printingEnabled: false,
          showBusinessName: true,
          showTable: true,
        },
      });
  });
  await page
    .getByRole("switch", { name: "Imprimir tickets", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByText("Ámbito retirado", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
  expect(requests.some((r) => /session/.test(r.path))).toBe(false);
});

test("same scope update preserves a draft and makes no resource cascade", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.getByRole("button", { name: "Nueva orden", exact: true }).click();
  const table = page.getByRole("textbox", {
    name: "Nombre de mesa",
    exact: true,
  });
  await table.fill("Mi borrador");
  const count = requests.length;
  await page.getByRole("button", { name: "Actualizar mismo ámbito" }).click();
  await expect(
    page.getByText("Contexto actualizado", { exact: true }),
  ).toBeVisible();
  await expect(table).toHaveValue("Mi borrador");
  await page.waitForTimeout(100);
  expect(requests).toHaveLength(count);
});

test("same user/business with another scope clears draft and ignores late A without retiring B", async ({
  page,
}) => {
  let finish!: () => Promise<void>;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path.endsWith("/orders")
        ? { open: [], closedToday: [] }
        : path.endsWith("/catalog")
          ? { products: [], categories: [], bestSellingProductIds: [] }
          : { printingEnabled: false, showBusinessName: true, showTable: true },
    });
  });
  await page.route("**/api/modules/pos/ticket", async (route) => {
    if (route.request().headers()["x-backoffice-scope"] === "a".repeat(64)) {
      await new Promise<void>((resolve) => {
        finish = async () => {
          await route.fulfill({
            status: 409,
            json: { code: "backoffice_context_changed" },
          });
          resolve();
        };
      });
    } else
      await route.fulfill({
        json: {
          printingEnabled: false,
          showBusinessName: true,
          showTable: true,
        },
      });
  });
  await page.goto(harness.url);
  await expect.poll(() => !!finish).toBe(true);
  await page.getByRole("button", { name: "Nueva orden", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nombre de mesa", exact: true })
    .fill("Borrador A");
  await page.getByRole("button", { name: "Cambiar a B" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre de mesa", exact: true }),
  ).toHaveCount(0);
  await finish();
  await expect(
    page.getByRole("button", { name: "Nueva orden", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("Ámbito retirado", { exact: true })).toHaveCount(
    0,
  );
});
