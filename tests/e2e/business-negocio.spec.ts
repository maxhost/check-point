import { test, expect } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { apiFixture, choose, row } from "./support/business-negocio-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/business-negocio-entry.tsx",
    "business",
  );
});
test.afterAll(async () => {
  await harness?.close();
});
test.use({ reducedMotion: "reduce" });
for (const width of [390, 1280])
  test(`Negocio ${width}: cuatro secciones, formas, payload parcial y vista`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await apiFixture(page);
    await page.goto(harness.url);
    for (const name of [
      "Medios de pago",
      "Configuración regional",
      "Datos fiscales",
      "Unidades de venta",
    ])
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
    await expect(
      row(page, "Efectivo").getByText("Sin comisión. Cero conocido."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Archivar Efectivo" }),
    ).toHaveCount(0);
    await expect(row(page, "Efectivo").getByRole("textbox")).toHaveCount(0);
    await expect(row(page, "Tarjeta").getByRole("textbox")).toHaveCount(1);
    await expect(row(page, "Transferencia").getByRole("textbox")).toHaveCount(
      1,
    );
    await expect(row(page, "Mixto").getByRole("textbox")).toHaveCount(2);
    await expect(
      row(page, "Mixto").getByText("Sin configurar", { exact: true }),
    ).toBeVisible();
    await row(page, "Mixto")
      .getByRole("textbox", { name: /Porcentaje/ })
      .fill("2.5");
    await row(page, "Mixto")
      .getByRole("button", { name: "Guardar comisión de Mixto" })
      .click();
    await expect.poll(() => api.writes.length).toBe(1);
    expect(api.writes[0]).toEqual({
      path: "payment-methods/mixed/commission",
      body: { expectedRevisionId: null, percent: "2.5", fixed: null },
    });
    await expect(
      row(page, "Mixto").getByText("Sin configurar", { exact: true }),
    ).toBeVisible();
    await expect(
      row(page, "Mixto").getByText(/no es un margen real/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`business-${width}.png`),
      fullPage: true,
    });
  });
test("alta desde catálogo/libre, archivo preservado y comisión por forma", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await choose(page, "Medio del catálogo", /^DeUna\b/);
  await page
    .getByRole("button", { name: "Agregar medio de pago", exact: true })
    .click();
  await expect(row(page, "DeUna")).toBeVisible();
  expect(api.writes[0].body).toEqual({ catalogId: "catalog-deuna" });
  await choose(page, "Origen del medio", "Medio libre");
  await page.getByRole("textbox", { name: "Nombre del medio" }).fill("Cheque");
  await choose(page, "Forma de cobro", "Importe fijo");
  await page
    .getByRole("button", { name: "Agregar medio de pago", exact: true })
    .click();
  await expect(row(page, "Cheque")).toBeVisible();
  expect(api.writes[1].body).toEqual({ name: "Cheque", chargeShape: "fixed" });
  await row(page, "Tarjeta").getByRole("textbox").fill("0");
  await row(page, "Tarjeta")
    .getByRole("button", { name: "Guardar comisión de Tarjeta" })
    .click();
  await expect.poll(() => api.writes.length).toBe(3);
  expect(api.writes[2].body).toEqual({
    expectedRevisionId: null,
    percent: "0",
  });
  await expect(
    row(page, "Tarjeta").getByText("Sin configurar", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Archivar Tarjeta", exact: true })
    .click();
  await expect(row(page, "Tarjeta").getByText(/Archivado/)).toBeVisible();
  await expect(row(page, "Tarjeta").getByRole("textbox")).toHaveCount(0);
});
test("conflicto de comisión conserva borrador, no actualiza otro medio y refresca explícito", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await row(page, "Mixto")
    .getByRole("textbox", { name: /Porcentaje/ })
    .fill("8");
  await row(page, "Tarjeta").getByRole("textbox").fill("3.25");
  api.fail = 409;
  await row(page, "Tarjeta")
    .getByRole("button", { name: "Guardar comisión de Tarjeta" })
    .click();
  await expect(
    row(page, "Tarjeta").getByText("Tu borrador se conserva"),
  ).toBeVisible();
  await expect(row(page, "Tarjeta").getByRole("textbox")).toHaveValue("3.25");
  await expect(
    row(page, "Tarjeta").getByRole("button", {
      name: "Guardar comisión de Tarjeta",
    }),
  ).toBeDisabled();
  api.fail = 0;
  api.methods[1].commission = {
    ...api.methods[1].commission,
    revisionId: "revision-current",
    percent: "1.00",
    configured: true,
  };
  await page
    .getByRole("button", { name: "Descartar borrador y actualizar Tarjeta" })
    .click();
  await expect(row(page, "Tarjeta").getByRole("textbox")).toHaveValue("1.00");
  await expect(
    row(page, "Mixto").getByRole("textbox", { name: /Porcentaje/ }),
  ).toHaveValue("8");
  await row(page, "Tarjeta")
    .getByRole("button", { name: "Guardar comisión de Tarjeta" })
    .click();
  await expect.poll(() => api.writes.length).toBe(2);
  expect(api.writes[1].body.expectedRevisionId).toBe("revision-current");
});
test("lectura rechazada y pérdida de permiso al guardar no dejan datos visibles", async ({
  page,
}) => {
  const api = await apiFixture(page);
  api.failRead = 403;
  await page.goto(harness.url);
  await expect(page.getByText("No tienes acceso.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Medios de pago" }),
  ).toHaveCount(0);
  api.failRead = 0;
  await page.reload();
  await expect(row(page, "Tarjeta")).toBeVisible();
  api.fail = 403;
  await row(page, "Tarjeta")
    .getByRole("button", { name: "Guardar comisión de Tarjeta" })
    .click();
  await expect(page.getByText(/Tu acceso cambió/)).toBeVisible();
  await expect(row(page, "Tarjeta")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
test("guardado en vuelo bloquea duplicados y 422 conserva borrador editable", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  let release!: () => void;
  api.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  api.fail = 422;
  await row(page, "Tarjeta").getByRole("textbox").fill("100.01");
  await row(page, "Tarjeta")
    .getByRole("button", { name: "Guardar comisión de Tarjeta" })
    .click();
  await expect(row(page, "Tarjeta").getByRole("textbox")).toBeDisabled();
  await expect.poll(() => api.writes.length).toBe(1);
  release();
  await expect(
    row(page, "Tarjeta").getByText("No pudimos guardar los cambios."),
  ).toBeVisible();
  await expect(row(page, "Tarjeta").getByRole("textbox")).toBeEnabled();
  await expect(row(page, "Tarjeta").getByRole("textbox")).toHaveValue("100.01");
  expect(api.writes).toHaveLength(1);
});

test("archivo confirmado no se revierte con respuesta tardía de comisión", async ({
  page,
}) => {
  const api = await apiFixture(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route(
    "**/api/business/payment-methods/card/commission",
    async (route) => {
      requested = true;
      const commission = {
        ...api.methods[1].commission,
        percent: "2",
        configured: true,
        revisionId: "committed-before-archive",
      };
      api.methods[1].commission = commission;
      await held;
      await route.fulfill({ json: { commission } });
    },
  );
  try {
    await page.goto(harness.url);
    await row(page, "Tarjeta").getByRole("textbox").fill("2");
    await row(page, "Tarjeta")
      .getByRole("button", { name: "Guardar comisión de Tarjeta" })
      .click();
    await expect.poll(() => requested).toBe(true);
    await page
      .getByRole("button", { name: "Archivar Tarjeta", exact: true })
      .click();
    await expect(row(page, "Tarjeta").getByText(/Archivado/)).toBeVisible();
    const response = page.waitForResponse(
      "**/api/business/payment-methods/card/commission",
    );
    release();
    await (await response).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(row(page, "Tarjeta").getByText(/Archivado/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Archivar Tarjeta", exact: true }),
    ).toHaveCount(0);
    await expect(row(page, "Tarjeta").getByRole("textbox")).toHaveCount(0);
    expect(api.methods[1].status).toBe("archived");
  } finally {
    release();
  }
});

test("refresco tras conflicto aprende archivo remoto sin reactivar el medio", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  api.fail = 409;
  await row(page, "Tarjeta")
    .getByRole("button", { name: "Guardar comisión de Tarjeta" })
    .click();
  await expect(
    row(page, "Tarjeta").getByText("Tu borrador se conserva"),
  ).toBeVisible();
  api.fail = 0;
  api.methods[1].status = "archived";
  await page
    .getByRole("button", { name: "Descartar borrador y actualizar Tarjeta" })
    .click();
  await expect(row(page, "Tarjeta").getByText(/Archivado/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archivar Tarjeta", exact: true }),
  ).toHaveCount(0);
  await expect(row(page, "Tarjeta").getByRole("textbox")).toHaveCount(0);
});
