import { expect, test } from "@playwright/test";
import {
  choose,
  completeManual,
  conceptId,
  expenseImage,
  localId,
  openRegistration,
  setupExpenses,
  startExpensesHarness,
  textDraft,
} from "./support/expenses-fixture";

let harness: Awaited<ReturnType<typeof startExpensesHarness>>;
test.beforeAll(async () => {
  harness = await startExpensesHarness();
});
test.afterAll(async () => {
  if (harness) await harness.close();
});

test("Dictado propone conceptos; corrección completa y lote único, retry usa misma operación", async ({
  page,
}) => {
  await setupExpenses(page);
  const drafts: unknown[] = [];
  await page.route("**/api/modules/expenses/entries/draft", (route) => {
    drafts.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        draft: {
          lines: [
            textDraft.lines[0],
            {
              ...textDraft.lines[0],
              name: "Horas extras Luis",
              amountMinor: "4000",
              isFixed: false,
            },
          ],
          unparsed: [],
        },
      },
    });
  });
  const writes: Record<string, unknown>[] = [];
  await page.route(/\/api\/modules\/expenses\/entries$/, (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill(
      writes.length === 1
        ? {
            status: 503,
            json: {
              error: "No pudimos guardar el lote. Reintenta.",
              code: "expenses_unavailable",
            },
          }
        : { status: 201, json: { expenses: [] } },
    );
  });
  const dialog = await openRegistration(page, harness.url);
  await dialog
    .getByRole("textbox", { name: "Describe tus pagos", exact: true })
    .fill("Pagué a Luis 450 y Luis horas extras 40");
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Revisa los pagos", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  expect(drafts).toEqual([
    { text: "Pagué a Luis 450 y Luis horas extras 40", locationId: localId },
  ]);
  const first = dialog.getByRole("region", { name: "Pago 1", exact: true });
  const second = dialog.getByRole("region", { name: "Pago 2", exact: true });
  await expect(first).toContainText("Concepto reconocido: Luis");
  await expect(second).toContainText("Concepto reconocido: Luis");
  await expect(
    first.getByRole("checkbox", { name: /^Gasto fijo/ }),
  ).toBeChecked();
  await expect(
    second.getByRole("checkbox", { name: /^Gasto fijo/ }),
  ).not.toBeChecked();
  await choose(page, second, "Concepto", "Nuevo concepto");
  await second
    .getByRole("textbox", { name: "Nombre del concepto", exact: true })
    .fill("Luis horas extras");
  await second
    .getByRole("textbox", { name: "Fecha de pago", exact: true })
    .fill("2026-07-31");
  await choose(page, second, "Local del pago", "Todo el negocio");
  await second.getByRole("checkbox", { name: /^Gasto fijo/ }).focus();
  await page.keyboard.press("Space");
  await expect(
    second.getByRole("checkbox", { name: /^Gasto fijo/ }),
  ).toBeChecked();
  await dialog.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(dialog).toContainText("No pudimos guardar el lote. Reintenta.");
  expect(writes).toHaveLength(1);
  await dialog
    .getByRole("button", { name: "Confirmar 2 pagos", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0].operationId).toMatch(/^[0-9a-f-]{36}$/);
  expect(writes[0]).toMatchObject({
    expectedCurrencyCode: "USD",
    lines: [
      { amountMinor: "45000", conceptId, isFixed: true, locationId: localId },
      {
        amountMinor: "4000",
        conceptId: null,
        conceptName: "Luis horas extras",
        category: "personnel",
        paidOn: "2026-07-31",
        isFixed: true,
        locationId: null,
      },
    ],
  });
  expect(JSON.stringify(writes)).not.toContain("sourceText");
});

test("Foto retiene archivos tras análisis y guardado fallidos; reanálisis y ACK liberan el borrador", async ({
  page,
}) => {
  await setupExpenses(page);
  const uploads: {
    keys: string[];
    location: string;
    name: string;
    type: string;
    bytes: number;
  }[] = [];
  let analyzes = 0;
  await page.route(
    "**/api/modules/expenses/entries/draft-photo",
    async (route) => {
      const form = await new Response(
        new Uint8Array(route.request().postDataBuffer()!),
        {
          headers: {
            "content-type": route.request().headers()["content-type"],
          },
        },
      ).formData();
      const photo = form.get("photos") as File;
      uploads.push({
        keys: [...form.keys()],
        location: String(form.get("locationId")),
        name: photo.name,
        type: photo.type,
        bytes: photo.size,
      });
      if (analyzes++ === 0)
        return route.fulfill({
          status: 503,
          json: {
            error: "No pudimos analizar la foto. Reintenta.",
            code: "draft_unavailable",
          },
        });
      return route.fulfill({ json: { draft: textDraft } });
    },
  );
  let writes = 0;
  await page.route(/\/api\/modules\/expenses\/entries$/, (route) => {
    writes++;
    expect(route.request().headers()["content-type"]).toBe("application/json");
    expect(route.request().postData()).not.toContain("photos");
    return route.fulfill(
      writes === 1
        ? {
            status: 503,
            json: {
              error: "No se guardó el lote. Reintenta.",
              code: "expenses_unavailable",
            },
          }
        : { status: 201, json: { expenses: [] } },
    );
  });
  let dialog = await openRegistration(page, harness.url, "Foto");
  await choose(page, dialog, "Local para estos pagos", "Todo el negocio");
  await dialog
    .getByLabel("Fotos de gastos desde galería")
    .setInputFiles(await expenseImage(page));
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(dialog).toContainText("No pudimos analizar la foto. Reintenta.");
  await expect(dialog).toContainText("pagos.png");
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Revisa los pagos", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Monto (USD)", exact: true })
    .fill("460");
  await dialog
    .getByRole("button", { name: "Confirmar pago", exact: true })
    .click();
  await expect(dialog).toContainText("No se guardó el lote. Reintenta.");
  await expect(
    dialog.getByRole("textbox", { name: "Monto (USD)", exact: true }),
  ).toHaveValue("460");
  await dialog
    .getByRole("button", { name: "Volver a las fotos", exact: true })
    .click();
  await expect(dialog).toContainText("pagos.png");
  await dialog
    .getByRole("button", {
      name: "Volver al borrador sin reanalizar",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Monto (USD)", exact: true }),
  ).toHaveValue("460");
  await dialog
    .getByRole("button", { name: "Volver a las fotos", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Revisa los pagos", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Confirmar pago", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(uploads).toHaveLength(3);
  for (const upload of uploads)
    expect(upload).toMatchObject({
      keys: ["photos", "locationId"],
      location: "business",
      name: "pagos.jpg",
      type: "image/jpeg",
    });
  expect(uploads[0].bytes).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Registrar gasto", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Registrar gasto", exact: true });
  await dialog.getByRole("button", { name: "Foto", exact: true }).click();
  await expect(dialog).not.toContainText("pagos.png");
  await expect(
    dialog.getByRole("button", { name: "Analizar", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Fotos de gastos desde galería")
    .setInputFiles(await expenseImage(page));
  await dialog.getByRole("button", { name: "Descartar", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar gasto", exact: true })
    .click();
  await page.getByRole("button", { name: "Foto", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toContainText("pagos.png");
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      indexed: indexedDB.databases ? "available" : "unavailable",
    })),
  ).toMatchObject({ local: [] });
});

test("IA incierta no inventa pagos globales ni permite confirmar fragmentos sin revisar", async ({
  page,
}) => {
  await setupExpenses(page);
  await page.route("**/api/modules/expenses/entries/draft", (route) =>
    route.fulfill({
      json: {
        draft: {
          lines: [
            {
              ...textDraft.lines[0],
              amountMinor: null,
              paidOn: null,
              locationId: null,
              isFixed: null,
            },
          ],
          unparsed: ["Monto y fecha ilegibles"],
        },
      },
    }),
  );
  const dialog = await openRegistration(page, harness.url);
  await dialog
    .getByRole("textbox", { name: "Describe tus pagos", exact: true })
    .fill("Luis monto ilegible");
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Confirmar pago", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Monto (USD)", exact: true })
    .fill("5");
  await dialog
    .getByRole("textbox", { name: "Fecha de pago", exact: true })
    .fill("2026-02-30");
  await choose(page, dialog, "Local del pago", "Centro");
  await dialog
    .getByRole("checkbox", {
      name: "He revisado estos fragmentos",
      exact: false,
    })
    .focus();
  await page.keyboard.press("Space");
  await expect(
    dialog.getByRole("button", { name: "Confirmar pago", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Fecha de pago", exact: true })
    .fill("2026-02-28");
  await expect(
    dialog.getByRole("button", { name: "Confirmar pago", exact: true }),
  ).toBeEnabled();
});

test("Carrera de moneda conserva montos hasta consultar contexto y revisar explícitamente", async ({
  page,
}) => {
  await setupExpenses(page);
  const writes: Record<string, unknown>[] = [];
  await page.route(/\/api\/modules\/expenses\/entries$/, (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill(
      writes.length === 1
        ? {
            status: 409,
            json: { error: "La moneda cambió.", code: "currency_conflict" },
          }
        : { status: 201, json: { expenses: [] } },
    );
  });
  const dialog = await openRegistration(page, harness.url, "Manual");
  const line = await completeManual(page, dialog);
  await dialog
    .getByRole("button", { name: "Confirmar pago", exact: true })
    .click();
  await expect(
    line.getByRole("textbox", { name: "Monto (USD)", exact: true }),
  ).toHaveValue("3,20");
  await expect(
    dialog.getByRole("button", { name: "Confirmar pago", exact: true }),
  ).toBeDisabled();
  await page.route("**/api/modules/expenses/context", (route) =>
    route.fulfill({
      json: {
        ...expenseContextForCurrency(),
        currencyCode: "COP",
        minorUnit: 0,
      },
    }),
  );
  await dialog
    .getByRole("button", {
      name: "Consultar moneda actual y revisar montos",
      exact: true,
    })
    .click();
  await expect(dialog).toContainText("no se han convertido");
  await expect(
    dialog.getByRole("button", { name: "Confirmar pago", exact: true }),
  ).toBeDisabled();
  await line
    .getByRole("textbox", { name: "Monto (COP)", exact: true })
    .fill("3200");
  await dialog
    .getByRole("button", { name: "Confirmar pago", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toMatchObject({
    expectedCurrencyCode: "COP",
    lines: [{ amountMinor: "3200" }],
  });
  expect(writes[1].operationId).not.toBe(writes[0].operationId);
});

function expenseContextForCurrency() {
  return {
    currencyCode: "USD",
    minorUnit: 2,
    timeZone: "America/Guayaquil",
    defaultLocationId: localId,
    locations: [{ id: localId, name: "Centro" }],
    categories: [{ id: "other", label: "Otro" }],
  };
}

for (const width of [390, 1280]) {
  test(`Inspección de composición, foco y desborde (${width})`, async ({
    page,
  }, info) => {
    await setupExpenses(page);
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openRegistration(page, harness.url, "Manual");
    await completeManual(page, dialog);
    await expect(
      dialog.getByRole("button", { name: "Confirmar pago", exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole("textbox", { name: "Monto (USD)", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await dialog.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(
      dialog.getByRole("heading", { name: "Registrar gasto", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`expenses-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Registrar gasto", exact: true }),
    ).toBeFocused();
  });
}
