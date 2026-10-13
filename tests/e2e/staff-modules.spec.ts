import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { businessModules, extraModule } from "./support/modules-fixture";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/modules-ui-harness.tsx",
    "staff",
  );
});
test.afterAll(async () => harness.close());

async function setup(page: Page, enabled = true, owner = true) {
  const modules = [...businessModules(enabled, enabled), extraModule(enabled)];
  let member = {
    userId: "member-1",
    name: "Carla",
    identifier: "carla",
    role: "staff",
    status: "active",
    permissions: ["counter", "stock", "recipes"],
    createdAt: "2026-10-13T12:00:00Z",
  };
  const writes: unknown[] = [];
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "caller" },
        membership: { role: owner ? "owner" : "staff", permissions: ["staff"] },
        business: { posEnabled: false },
      },
    }),
  );
  await page.route("**/api/onboarding/**", (route) =>
    route.fulfill({ json: { completed: true, steps: [] } }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules } }),
  );
  await page.route("**/api/staff", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      writes.push(body);
      return route.fulfill({
        json: {
          staff: { ...member, ...body, userId: "new-member" },
          pin: "123456",
        },
      });
    }
    return route.fulfill({ json: { staff: [member] } });
  });
  await page.route("**/api/staff/member-1/permissions", (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    member = { ...member, ...body };
    return route.fulfill({ json: { staff: member } });
  });
  return { modules, writes };
}

for (const width of [390, 1280]) {
  test(`Equipo muestra labels y descripciones del DTO y otorga permisos (${width})`, async ({
    page,
  }, testInfo) => {
    const api = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${harness.url}?surface=staff`);
    await expect(page.locator(".staff-card-copy p")).toHaveText(
      "Mostrador · Stock · Recetas",
    );
    await page.getByRole("button", { name: "+ Añadir integrante" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo integrante" });
    await expect(
      dialog.getByRole("switch", { name: "Stock", exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByText("Insumos, compras, ajustes y stock estimado.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Recetas, costo y margen de cada producto.", {
        exact: true,
      }),
    ).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Nombre", exact: true })
      .fill("Ana");
    await dialog
      .getByRole("switch", { name: "Stock", exact: true })
      .locator("xpath=ancestor::label")
      .click();
    await dialog
      .getByRole("switch", { name: "Recetas", exact: true })
      .locator("xpath=ancestor::label")
      .click();
    await dialog
      .getByRole("switch", { name: "Gestionar turnos", exact: true })
      .locator("xpath=ancestor::label")
      .click();
    await page.screenshot({
      path: testInfo.outputPath(`staff-modules-${width}.png`),
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Crear y mostrar PIN" }).click();
    await expect.poll(() => api.writes.length).toBe(1);
    expect(api.writes).toEqual([
      {
        name: "Ana",
        permissions: ["counter", "stock", "recipes", "appointments_manage"],
      },
    ]);
  });
}

test("módulos apagados no se otorgan y los permisos previos se conservan al editar", async ({
  page,
}) => {
  const api = await setup(page, false);
  await page.goto(`${harness.url}?surface=staff`);
  await expect(page.locator(".staff-card-copy p")).toHaveText(
    "Mostrador · Stock · Recetas",
  );
  await page.getByRole("button", { name: "+ Añadir integrante" }).click();
  const create = page.getByRole("dialog", { name: "Nuevo integrante" });
  await expect(
    create.getByRole("switch", { name: "Stock", exact: true }),
  ).toBeDisabled();
  await expect(
    create.getByRole("switch", { name: "Stock", exact: true }),
  ).not.toBeChecked();
  await create.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Gestionar", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Carla", exact: true });
  for (const name of ["Stock", "Recetas"]) {
    await expect(
      editor.getByRole("switch", { name, exact: true }),
    ).toBeDisabled();
    await expect(
      editor.getByRole("switch", { name, exact: true }),
    ).toBeChecked();
  }
  await editor
    .getByRole("switch", { name: "Catálogo", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes).toEqual([
    { permissions: ["counter", "stock", "recipes", "catalog"] },
  ]);
});

test("fallo GET ofrece reintento sin impedir permisos core; 422 conserva borrador", async ({
  page,
}) => {
  const api = await setup(page);
  let failing = true;
  await page.route("**/api/modules", (route) =>
    route.fulfill(
      failing
        ? { status: 503, json: { error: "Módulos no disponibles" } }
        : { json: { modules: api.modules } },
    ),
  );
  await page.route("**/api/staff", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 422,
          json: { code: "module_disabled_permission" },
        })
      : route.fulfill({ json: { staff: [] } }),
  );
  await page.goto(`${harness.url}?surface=staff`);
  await expect(page.getByRole("alert")).toContainText("Módulos no disponibles");
  await page.getByRole("button", { name: "+ Añadir integrante" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo integrante" });
  await expect(
    dialog.getByRole("switch", { name: "Mostrador", exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("switch", { name: "Stock", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  failing = false;
  await page
    .getByRole("button", { name: "Reintentar permisos de módulos" })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "+ Añadir integrante" }).click();
  await dialog
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Ana");
  await dialog
    .getByRole("switch", { name: "Stock", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  await dialog.getByRole("button", { name: "Crear y mostrar PIN" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Ese módulo está desactivado.",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Nombre", exact: true }),
  ).toHaveValue("Ana");
  await expect(
    dialog.getByRole("switch", { name: "Stock", exact: true }),
  ).toBeChecked();
});

test("administrador delegado puede otorgar módulos pero no Administrador", async ({
  page,
}) => {
  await setup(page, true, false);
  await page.goto(`${harness.url}?surface=staff&role=staff&permissions=staff`);
  await page.getByRole("button", { name: "+ Añadir integrante" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo integrante" });
  await expect(
    dialog.getByRole("switch", { name: "Stock", exact: true }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("switch", { name: "Administrador", exact: true }),
  ).toBeDisabled();
});
