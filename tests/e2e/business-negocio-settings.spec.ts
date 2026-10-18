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
  api.units.revision = 5;
  api.fiscal = {
    chargesVat: true,
    saleVatRate: "0.00",
    recoversPurchaseVat: false,
    revision: 5,
  };
  await page
    .getByRole("button", {
      name: "Consultar configuración y conservar mis cambios",
    })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Tasa de IVA de venta (%)",
      exact: true,
    }),
  ).toHaveValue("19");
  await expect(
    page.getByRole("button", { name: /Zona horaria del negocio/ }),
  ).toContainText("America/Lima");
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

test("cambio concurrente de moneda conserva fijo y moneda del editor hasta acción explícita", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await row(page, "Transferencia")
    .getByRole("textbox", { name: "Fijo de Transferencia (USD)" })
    .fill("0.60");
  // Another session commits a regional change after this editor's initial GET.
  api.regional.currencyCode = "EUR";
  api.regional.revision = 2;
  api.fiscal.revision = 2;
  api.units.revision = 2;
  await row(page, "Transferencia")
    .getByRole("button", { name: "Guardar comisión de Transferencia" })
    .click();
  await expect(
    row(page, "Transferencia").getByText("La moneda del negocio cambió.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(api.writes[0].body).toEqual({
    expectedRevisionId: null,
    fixed: "0.60",
    expectedCurrencyCode: "USD",
  });
  expect(api.methods[2].commission.revisionId).toBeNull();
  await expect(
    row(page, "Transferencia").getByRole("textbox", {
      name: "Fijo de Transferencia (USD)",
    }),
  ).toHaveValue("0.60");
  await expect(
    row(page, "Transferencia").getByRole("button", {
      name: "Guardar comisión de Transferencia",
    }),
  ).toBeDisabled();
  await row(page, "Transferencia")
    .getByRole("button", { name: "Actualizar moneda del negocio", exact: true })
    .click();
  await expect(
    row(page, "Transferencia").getByRole("textbox", {
      name: "Fijo de Transferencia (USD)",
    }),
  ).toHaveValue("0.60");
  await expect(
    row(page, "Transferencia").getByRole("button", {
      name: "Guardar comisión de Transferencia",
    }),
  ).toBeDisabled();
  expect(api.writes).toHaveLength(1);
  await row(page, "Transferencia")
    .getByRole("button", { name: "Configurar fijo en EUR", exact: true })
    .click();
  const input = row(page, "Transferencia").getByRole("textbox", {
    name: "Fijo de Transferencia (EUR)",
  });
  await expect(input).toHaveValue("");
  await input.fill("0.70");
  await row(page, "Transferencia")
    .getByRole("button", { name: "Guardar comisión de Transferencia" })
    .click();
  await expect.poll(() => api.writes.length).toBe(2);
  expect(api.writes[1].body).toEqual({
    expectedRevisionId: null,
    fixed: "0.70",
    expectedCurrencyCode: "EUR",
  });
  await expect(
    row(page, "Transferencia").getByText(/Comisión guardada/),
  ).toBeVisible();
});

const saveUnits = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Guardar unidades de venta", exact: true });
const consult = (page: import("@playwright/test").Page) =>
  page.getByRole("button", {
    name: "Consultar configuración y conservar mis cambios",
  });

test("tres borradores conservan intención al guardar cada sección con revisión compartida", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await expect.poll(() => api.reads.length).toBe(5);
  await choose(page, "Zona horaria del negocio", "America/Lima");
  await choose(page, "¿Recuperas el IVA", "Sí");
  await page.getByText("Libra (lb)", { exact: true }).click();
  await saveUnits(page).click();
  await expect(
    page.getByText("Unidades de venta guardadas.", { exact: true }),
  ).toBeVisible();
  expect(api.writes[0].body).toEqual({
    salesMassUnits: ["kg", "lb"],
    revision: 1,
  });
  await page
    .getByRole("button", {
      name: "Guardar configuración regional",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Configuración regional guardada.", { exact: true }),
  ).toBeVisible();
  expect(api.writes[1].body).toEqual({
    timezone: "America/Lima",
    currencyCode: "USD",
    revision: 2,
  });
  await page
    .getByRole("button", { name: "Guardar datos fiscales", exact: true })
    .click();
  await expect(
    page.getByText("Datos fiscales guardados.", { exact: true }),
  ).toBeVisible();
  expect(api.writes[2].body).toEqual({
    chargesVat: false,
    saleVatRate: null,
    recoversPurchaseVat: true,
    revision: 3,
  });
  await saveUnits(page).click();
  await expect.poll(() => api.writes.length).toBe(4);
  expect(api.writes[3].body).toEqual({
    salesMassUnits: ["kg", "lb"],
    revision: 4,
  });
});

test("selección vacía y 422 mantienen selección editable, unit_in_use identifica productos seguros", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await page.getByText("Kilogramo (kg)", { exact: true }).click();
  await saveUnits(page).click();
  await expect(
    page.getByText("Elige al menos una unidad de venta.", { exact: true }),
  ).toBeVisible();
  expect(api.writes).toHaveLength(0);
  await page.getByText("Libra (lb)", { exact: true }).click();
  api.fail = 422;
  api.errorFields = { salesMassUnits: "Revisa las unidades seleccionadas." };
  await saveUnits(page).click();
  await expect(
    page.getByText("Revisa las unidades seleccionadas.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Libra (lb)" }),
  ).toBeChecked();
  await expect(saveUnits(page)).toBeEnabled();
  api.fail = 409;
  api.errorFields = undefined;
  api.errorProducts = [
    { id: "same-business-product", name: "Café <especial>" },
  ];
  await saveUnits(page).click();
  await expect(page.getByText(/Productos: Café <especial>/)).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Libra (lb)" }),
  ).toBeChecked();
});

test("conflicto conserva editados, adopta intactos y rechaza refresco con revisiones cruzadas", async ({
  page,
}) => {
  const api = await apiFixture(page);
  await page.goto(harness.url);
  await choose(page, "Zona horaria del negocio", "America/Lima");
  await page.getByText("Libra (lb)", { exact: true }).click();
  api.fail = 409;
  await saveUnits(page).click();
  await expect(consult(page)).toBeVisible();
  api.fail = 0;
  api.regional = {
    timezone: "America/Bogota",
    currencyCode: "EUR",
    revision: 5,
  };
  api.fiscal = {
    chargesVat: false,
    saleVatRate: "12.00",
    recoversPurchaseVat: true,
    revision: 5,
  };
  api.units = { salesMassUnits: ["g"], revision: 4 };
  await consult(page).click();
  await expect(
    page.getByText(/La configuración cambió mientras/),
  ).toBeVisible();
  await expect(saveUnits(page)).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: "Libra (lb)" }),
  ).toBeChecked();
  api.units.revision = 5;
  await consult(page).click();
  await expect(saveUnits(page)).toBeEnabled();
  await expect(
    page.getByRole("button", { name: /Zona horaria del negocio/ }),
  ).toContainText("America/Lima");
  await expect(page.getByRole("button", { name: /Moneda/ })).toContainText(
    "Euro",
  );
  await expect(
    page.getByRole("textbox", {
      name: "Tasa de IVA de venta (%)",
      exact: true,
    }),
  ).toHaveValue("12.00");
  await expect(
    page.getByText(
      /Zona horaria: tu borrador America\/Lima; guardado America\/Bogota/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Unidades de venta: tu borrador kg, lb; guardado g/),
  ).toBeVisible();
  expect(api.writes).toHaveLength(1);
  await saveUnits(page).click();
  await expect.poll(() => api.writes.length).toBe(2);
  expect(api.writes[1].body).toEqual({
    salesMassUnits: ["kg", "lb"],
    revision: 5,
  });
});

for (const status of [0, 500])
  test(`resultado incierto ${status} no reintenta ni duplica y exige consulta`, async ({
    page,
  }) => {
    const api = await apiFixture(page);
    await page.goto(harness.url);
    await page.getByText("Libra (lb)", { exact: true }).click();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    await page.route("**/api/business/sales-units", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: api.units });
      writes++;
      await held;
      if (status === 0) return route.abort("failed");
      return route.fulfill({
        status,
        json: { error: "No pudimos confirmar el resultado." },
      });
    });
    try {
      await saveUnits(page).click();
      await expect.poll(() => writes).toBe(1);
      await expect(saveUnits(page)).toBeDisabled();
      release();
      await expect(consult(page)).toBeVisible();
      await expect(saveUnits(page)).toBeDisabled();
      await expect(
        page.getByRole("checkbox", { name: "Libra (lb)" }),
      ).toBeChecked();
      expect(writes).toBe(1);
    } finally {
      release();
    }
  });

for (const status of [401, 403])
  test(`unidades ${status} retira todas las configuraciones`, async ({
    page,
  }) => {
    const api = await apiFixture(page);
    await page.goto(harness.url);
    api.fail = status;
    await saveUnits(page).click();
    await expect(page.getByText(/Tu acceso cambió/)).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });

test("revisiones iniciales distintas bloquean guardado hasta consulta coherente sin perder datos", async ({
  page,
}) => {
  const api = await apiFixture(page);
  api.units.revision = 2;
  await page.goto(harness.url);
  await expect(saveUnits(page)).toBeDisabled();
  await consult(page).click();
  await expect(
    page.getByText(/La configuración cambió mientras/),
  ).toBeVisible();
  api.regional.revision = 2;
  api.fiscal.revision = 2;
  await consult(page).click();
  await expect(saveUnits(page)).toBeEnabled();
  await saveUnits(page).click();
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes[0].body.revision).toBe(2);
});
