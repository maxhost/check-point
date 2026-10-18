import { test, expect } from "@playwright/test";
import {
  startRecipesHarness,
  setupRecipes,
  editRecipe,
  chooseUnit,
} from "./support/recipes-basis-fixture";
let harness: Awaited<ReturnType<typeof startRecipesHarness>>;
test.beforeAll(async () => {
  harness = await startRecipesHarness();
});
test.afterAll(async () => {
  await harness.close();
});
for (const quantity of ["2", "10"])
  test(`legacy explícita y base ${quantity}unit conserva multiplicador`, async ({
    page,
  }) => {
    const api = await setupRecipes(page);
    await editRecipe(page, harness.url);
    await expect(
      page.getByRole("textbox", { name: "Cantidad de producto obtenido" }),
    ).toHaveValue("1");
    await page
      .getByRole("textbox", { name: "Cantidad de producto obtenido" })
      .fill(quantity);
    await page
      .getByRole("button", { name: "Confirmar receta", exact: true })
      .click();
    await expect.poll(() => api.writes.length).toBe(1);
    expect(api.writes[0].body).toMatchObject({
      basisQuantity: quantity,
      basisUnit: "unit",
      conversionVersion: "mass-si-1",
      expectedRevisionId: "composition-1",
      recipes: [{ recipeId: "recipe-1", quantity: "2" }],
    });
  });
test("base mass precisa, remonte y cambio sin reescalar", async ({ page }) => {
  const api = await setupRecipes(
    page,
    {
      basisQuantity: "1.123456789",
      basisUnit: "lb",
      conversionVersion: "mass-si-1",
    },
    "incompatible_basis",
  );
  await editRecipe(page, harness.url);
  await expect(
    page.getByRole("textbox", { name: "Cantidad de producto obtenido" }),
  ).toHaveValue("1.123456789");
  await chooseUnit(page, "Gramos (g)");
  await page
    .getByRole("textbox", { name: "Cantidad de producto obtenido" })
    .fill("100");
  await page
    .getByRole("button", { name: "Confirmar receta", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes[0].body).toMatchObject({
    basisQuantity: "100",
    basisUnit: "g",
    recipes: [{ recipeId: "recipe-1", quantity: "2" }],
  });
  await page.getByRole("button", { name: "Editar receta de Pan" }).click();
  await expect(
    page.getByRole("textbox", { name: "Cantidad de producto obtenido" }),
  ).toHaveValue("100");
});
test("rechaza entradas y metadata parcial", async ({ page }) => {
  const api = await setupRecipes(page);
  await editRecipe(page, harness.url);
  for (const value of ["0", "1.5", "1e3", "0.1234567891", "1000000000"]) {
    await page
      .getByRole("textbox", { name: "Cantidad de producto obtenido" })
      .fill(value);
    await expect(
      page.getByRole("button", { name: "Confirmar receta", exact: true }),
    ).toBeDisabled();
  }
  expect(api.writes).toHaveLength(0);
  await page.reload();
  api.remote({ basisQuantity: "2" });
  await page.getByRole("button", { name: "Editar receta de Pan" }).click();
  await expect(
    page.getByText("Base guardada sin verificar", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar receta", exact: true }),
  ).toBeDisabled();
});
for (const failure of [409, 500, "network"] as const)
  test(`error ${failure} conserva base y exige consulta`, async ({ page }) => {
    const api = await setupRecipes(page);
    await editRecipe(page, harness.url);
    await page
      .getByRole("textbox", { name: "Cantidad de producto obtenido" })
      .fill("10");
    api.fail(failure);
    await page
      .getByRole("button", { name: "Confirmar receta", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Consultar estado guardado" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Cantidad de producto obtenido" }),
    ).toHaveValue("10");
    await expect(
      page.getByRole("button", { name: "Confirmar receta", exact: true }),
    ).toBeDisabled();
    api.remote({
      revisionId: "remote-2",
      basisQuantity: "2",
      basisUnit: "unit",
      conversionVersion: "mass-si-1",
    });
    api.fail(null);
    await page
      .getByRole("button", { name: "Consultar estado guardado" })
      .click();
    await expect(page.getByText(/Base guardada: 2 unidades/)).toBeVisible();
    await page
      .getByRole("button", {
        name: "Conservar borrador con la revisión consultada",
      })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Cantidad de producto obtenido" }),
    ).toHaveValue("10");
    await page
      .getByRole("button", { name: "Confirmar receta", exact: true })
      .click();
    await expect.poll(() => api.writes.length).toBe(2);
    expect(api.writes[1].body).toMatchObject({
      basisQuantity: "10",
      expectedRevisionId: "remote-2",
    });
  });
for (const status of [401, 403])
  test(`revoca datos ${status}`, async ({ page }) => {
    const api = await setupRecipes(page);
    await editRecipe(page, harness.url);
    api.fail(status);
    await page
      .getByRole("button", { name: "Confirmar receta", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Cantidad de producto obtenido" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Confirmar receta", exact: true }),
    ).toHaveCount(0);
  });
test("partialSave reintenta solo composición y bloquea doble envío", async ({
  page,
}) => {
  const api = await setupRecipes(page);
  await editRecipe(page, harness.url);
  await page.getByRole("button", { name: "Atrás", exact: true }).click();
  await page.getByRole("button", { name: "Atrás", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nombre de la receta", exact: true })
    .fill("Masa nueva");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Revisar los ingredientes actuales" })
    .click();
  api.fail(422);
  api.delay(150);
  await page
    .getByRole("button", { name: "Confirmar receta", exact: true })
    .dblclick();
  await expect(
    page.getByText(
      "La receta ya se guardó. Falta confirmar su composición en el producto.",
    ),
  ).toBeVisible();
  api.fail(null);
  await page
    .getByRole("button", { name: "Confirmar receta", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(3);
  expect(
    api.writes.filter((entry) => entry.url.includes("library")),
  ).toHaveLength(1);
});
for (const status of [
  "complete",
  "incompatible_basis",
  "rounded_to_zero",
  "missing_costs",
])
  test(`costo ${status} y vista390/1280`, async ({ page }) => {
    await setupRecipes(
      page,
      {
        basisQuantity: status === "complete" ? "2" : "100",
        basisUnit: status === "complete" ? "unit" : "g",
        conversionVersion: "mass-si-1",
      },
      status,
    );
    await page.goto(harness.url);
    await expect(
      page.getByText("Costo, precio y ganancia por 1 unidad"),
    ).toBeVisible();
    if (status === "incompatible_basis")
      await expect(
        page.getByText("La base y el modo de venta no son compatibles"),
      ).toBeVisible();
    if (status === "rounded_to_zero")
      await expect(
        page.getByText("Consumo menor que la precisión de stock"),
      ).toBeVisible();
    if (status === "missing_costs")
      await expect(page.getByText("Falta costo en este local")).toBeVisible();
    if (status === "complete") {
      await expect(page.getByText(/USD.*0,00/)).toBeVisible();
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 950 });
        await page.screenshot({
          path: `/private/tmp/checkpass-pos-0242/recipes-list-${width}.png`,
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Editar receta de Pan" }).click();
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 1100 });
        await page
          .getByRole("textbox", { name: "Cantidad de producto obtenido" })
          .waitFor();
        await expect(
          page.getByRole("button", { name: "Confirmar receta", exact: true }),
        ).toBeEnabled();
        await page.screenshot({
          path: `/private/tmp/checkpass-pos-0242/recipes-modal-${width}.png`,
          fullPage: true,
        });
      }
    }
  });

test("nueva biblioteca POST y fallo composición no duplica receta ni insumos", async ({
  page,
}) => {
  const api = await setupRecipes(page);
  api.remote({ recipes: [] });
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Nueva receta", exact: true }).click();
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar producto" }).fill("Pan");
  await page.getByRole("button", { name: "Pan", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Cargar a mano" }).click();
  await page
    .getByRole("textbox", { name: "Nombre del insumo nuevo" })
    .fill("Harina nueva");
  await page
    .getByRole("textbox", {
      name: "Cantidad por unidad de la receta",
      exact: true,
    })
    .fill("50");
  api.fail(422);
  await page
    .getByRole("button", { name: "Confirmar receta", exact: true })
    .click();
  await expect(
    page.getByText(
      "La receta ya se guardó. Falta confirmar su composición en el producto.",
    ),
  ).toBeVisible();
  api.fail(null);
  await page
    .getByRole("button", { name: "Confirmar receta", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(3);
  expect(
    api.writes.filter((entry) => entry.url.endsWith("library")),
  ).toHaveLength(1);
  expect(api.writes[0].body).toMatchObject({
    lines: [{ newItem: { name: "Harina nueva" }, quantity: "50", unit: "g" }],
  });
});
