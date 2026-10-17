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
test("Regional/Fiscal conservan comportamiento y revisiones compartidas sin enviar branding", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await expect(
    page.getByRole("textbox", {
      name: "Tasa de IVA de venta (%)",
      exact: true,
    }),
  ).toBeDisabled();
  await choose(page, "Zona horaria del negocio", "America/Lima");
  await page
    .getByRole("button", {
      name: "Guardar configuración regional",
      exact: true,
    })
    .click();
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes[0].body).toEqual({
    timezone: "America/Lima",
    currencyCode: "USD",
    revision: 1,
  });
  await choose(page, "¿Cobras IVA", "Sí");
  await page
    .getByRole("button", { name: "Guardar datos fiscales", exact: true })
    .click();
  expect(api.writes).toHaveLength(1);
  const rate = page.getByRole("textbox", {
    name: "Tasa de IVA de venta (%)",
    exact: true,
  });
  await rate.fill("15.001");
  await page
    .getByRole("button", { name: "Guardar datos fiscales", exact: true })
    .click();
  expect(api.writes).toHaveLength(1);
  await rate.fill("15.5");
  await choose(page, "¿Recuperas el IVA", "Sí");
  await choose(page, "¿Cobras IVA", "No");
  await expect(rate).toHaveValue("15.5");
  await page
    .getByRole("button", { name: "Guardar datos fiscales", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(2);
  expect(api.writes[1].body).toEqual({
    chargesVat: false,
    saleVatRate: "15.50",
    recoversPurchaseVat: true,
    revision: 2,
  });
  expect(api.writes.flatMap((write) => Object.keys(write.body))).not.toContain(
    "brandRevision",
  );
  await page.reload();
  await expect(rate).toHaveValue("15.50");
  await expect(rate).toBeDisabled();
});
test("conflicto Regional/Fiscal conserva ambos borradores y refresca ambas revisiones", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await choose(page, "Zona horaria del negocio", "America/Lima");
  await choose(page, "¿Cobras IVA", "Sí");
  await page
    .getByRole("textbox", { name: "Tasa de IVA de venta (%)", exact: true })
    .fill("19");
  api.fail = 409;
  await page
    .getByRole("button", {
      name: "Guardar configuración regional",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Tu borrador se conserva", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: "Tasa de IVA de venta (%)",
      exact: true,
    }),
  ).toHaveValue("19");
  api.fail = 0;
  api.regional.revision = 5;
  api.fiscal = {
    chargesVat: true,
    saleVatRate: "0.00",
    recoversPurchaseVat: false,
    revision: 5,
  };
  await page
    .getByRole("button", {
      name: "Descartar borradores y actualizar configuración",
    })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Tasa de IVA de venta (%)",
      exact: true,
    }),
  ).toHaveValue("0.00");
  await expect(
    page.getByRole("button", { name: /Zona horaria del negocio/ }),
  ).toContainText("America/Guayaquil");
  expect(api.reads.filter((path) => path === "regional")).toHaveLength(2);
  expect(api.reads.filter((path) => path === "fiscal")).toHaveLength(2);
});
test("cambio de moneda mantiene fijo previo identificado y exige configuración explícita", async ({
  page,
}) => {
  const api = await apiFixture(page);
  api.regional.currencyCode = "COP";
  api.methods[2].commission = {
    ...api.methods[2].commission,
    revisionId: "fixed-old",
    fixed: "1",
    originalFixed: { numerator: "60", denominator: "1", scale: 2 },
    currencyCode: "COP",
    minorUnit: 0,
    configured: true,
  };
  await page.goto(harness.url);
  await expect(row(page, "Transferencia").getByRole("textbox")).toHaveValue(
    "0.60",
  );
  await choose(page, "Moneda", "Euro (EUR)");
  await page
    .getByRole("button", {
      name: "Guardar configuración regional",
      exact: true,
    })
    .click();
  await expect(
    row(page, "Transferencia").getByText(/Fijo guardado: 0.60 COP/),
  ).toBeVisible();
  await expect(
    row(page, "Transferencia").getByRole("textbox", {
      name: "Fijo de Transferencia (COP)",
    }),
  ).toHaveValue("0.60");
  await expect(
    row(page, "Transferencia").getByRole("button", {
      name: "Guardar comisión de Transferencia",
    }),
  ).toBeDisabled();
  await row(page, "Transferencia")
    .getByRole("button", { name: "Configurar fijo en EUR" })
    .click();
  await expect(
    row(page, "Transferencia").getByRole("textbox", {
      name: "Fijo de Transferencia (EUR)",
    }),
  ).toHaveValue("");
  expect(api.writes).toHaveLength(1);
});
