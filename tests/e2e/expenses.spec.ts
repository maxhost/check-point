import { expect, test } from "@playwright/test";
import {
  choose,
  completeManual,
  expenseId,
  historicalExpense,
  localId,
  openRegistration,
  secondLocalId,
  setupExpenses,
  startExpensesHarness,
} from "./support/expenses-fixture";

let harness: Awaited<ReturnType<typeof startExpensesHarness>>;
test.beforeAll(async () => {
  harness = await startExpensesHarness();
});
test.afterAll(async () => {
  if (harness) await harness.close();
});

test("Permiso antes de leer gastos, conceptos o sueldos; owner y staff expenses acceden", async ({
  page,
}) => {
  const denied = await setupExpenses(page, {
    role: "staff",
    permissions: ["staff"],
  });
  await page.goto(harness.url);
  await expect(
    page.getByText("No tienes acceso a Gastos.", { exact: true }),
  ).toBeVisible();
  expect(denied.reads).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Registrar gasto", exact: true }),
  ).toHaveCount(0);
  await setupExpenses(page, { role: "staff", permissions: ["expenses"] });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Registrar gasto", exact: true }),
  ).toBeVisible();
});

test("El día comercial y filtros inclusivos de mes histórico viajan sin conversión UTC", async ({
  page,
}) => {
  const { reads } = await setupExpenses(page, { entries: [historicalExpense] });
  await page.goto(`${harness.url}?locationId=${secondLocalId}`);
  await expect(
    page.getByRole("textbox", { name: "Hasta", exact: true }),
  ).toHaveValue("2026-10-16");
  await expect(page.getByText("No hay pagos en este rango.")).toBeVisible();
  expect(
    reads.some((url) => url.includes(`context?locationId=${secondLocalId}`)),
  ).toBe(true);
  await page
    .getByRole("textbox", { name: "Desde", exact: true })
    .fill("2026-07-01");
  await page
    .getByRole("textbox", { name: "Hasta", exact: true })
    .fill("2026-07-31");
  await page
    .getByRole("button", { name: "Filtrar gastos", exact: true })
    .click();
  await expect(
    page.getByRole("list", { name: "Registro de gastos" }),
  ).toContainText("Sueldo Luis");
  expect(
    reads.some((url) => url.endsWith("entries?from=2026-07-01&to=2026-07-31")),
  ).toBe(true);
  await choose(
    page,
    page.locator("main"),
    "Local del registro",
    "Todo el negocio",
  );
  await page
    .getByRole("button", { name: "Filtrar gastos", exact: true })
    .click();
  await expect(page.getByText("No hay pagos en este rango.")).toBeVisible();
  expect(reads.at(-1)).toContain("locationId=business");
});

test("Local pendiente no significa todo el negocio; fijo no requiere paso y monto exacto", async ({
  page,
}) => {
  await setupExpenses(page, { defaultLocationId: null });
  const requests: Record<string, unknown>[] = [];
  await page.route(/\/api\/modules\/expenses\/entries$/, (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { expenses: [] } });
  });
  const dialog = await openRegistration(page, harness.url, "Manual");
  const line = await completeManual(page, dialog);
  await expect(
    line.getByRole("textbox", { name: "Fecha de pago", exact: true }),
  ).toHaveValue("2026-10-16");
  await expect(
    dialog.getByRole("button", { name: "Confirmar pago", exact: true }),
  ).toBeDisabled();
  await line
    .getByRole("textbox", { name: "Monto (USD)", exact: true })
    .fill("90071992547409,93");
  await choose(page, line, "Local del pago", "Todo el negocio");
  await expect(
    line.getByRole("checkbox", { name: /^Gasto fijo/ }),
  ).not.toBeChecked();
  await dialog
    .getByRole("button", { name: "Confirmar pago", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    expectedCurrencyCode: "USD",
    lines: [
      {
        paidOn: "2026-10-16",
        amountMinor: "9007199254740993",
        category: "other",
        conceptId: null,
        conceptName: "Garrafa",
        name: "Compra de garrafa",
        isFixed: false,
        locationId: null,
      },
    ],
  });
});

test("Histórico conserva moneda y correcciones en conflicto; recarga revisión y borra con confirmación", async ({
  page,
}) => {
  const entries = [{ ...historicalExpense }];
  await setupExpenses(page, {
    entries,
    currencyCode: "COP",
    minorUnit: 0,
    archived: true,
  });
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  let editCalls = 0;
  await page.route(`**/api/modules/expenses/entries/${expenseId}`, (route) => {
    writes.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
    if (route.request().method() === "PUT" && editCalls++ === 0) {
      entries[0] = {
        ...entries[0],
        revision: 2,
        amountMinor: "47000",
        revisionId: "77777777-7777-4777-8777-777777777777",
      };
      return route.fulfill({
        status: 409,
        json: {
          error: "Otra persona editó este gasto.",
          code: "expense_conflict",
        },
      });
    }
    if (route.request().method() === "DELETE") {
      const current = entries.pop()!;
      return route.fulfill({
        json: {
          expense: {
            ...current,
            revision: current.revision + 1,
            deletedAt: "2026-10-17T03:00:00Z",
            revisionId: "99999999-9999-4999-8999-999999999999",
          },
        },
      });
    }
    entries[0] = {
      ...entries[0],
      revision: 3,
      amountMinor: String(route.request().postDataJSON().amountMinor),
      revisionId: "88888888-8888-4888-8888-888888888888",
    };
    return route.fulfill({
      json: { expense: entries[0] },
    });
  });
  await page.goto(harness.url);
  await page
    .getByRole("textbox", { name: "Desde", exact: true })
    .fill("2026-07-01");
  await page
    .getByRole("textbox", { name: "Hasta", exact: true })
    .fill("2026-07-31");
  await page
    .getByRole("button", { name: "Filtrar gastos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar Sueldo Luis", exact: true })
    .click();
  let dialog = page.getByRole("dialog", { name: "Editar gasto", exact: true });
  await expect(
    dialog.getByRole("textbox", { name: "Monto (USD)", exact: true }),
  ).toHaveValue("450.00");
  await expect(
    dialog.getByRole("button", { name: /Centro · Archivado Local del pago/ }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Monto (USD)", exact: true })
    .fill("490,25");
  await dialog
    .getByRole("textbox", { name: "Fecha de pago", exact: true })
    .fill("2026-06-30");
  await choose(page, dialog, "Local del pago", "Todo el negocio");
  await dialog
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(dialog).toContainText("Tus correcciones siguen aquí.");
  await expect(
    dialog.getByRole("textbox", { name: "Monto (USD)", exact: true }),
  ).toHaveValue("490,25");
  expect(writes[0]).toMatchObject({
    method: "PUT",
    body: {
      expectedRevision: 1,
      expectedCurrencyCode: "USD",
      amountMinor: "49025",
      paidOn: "2026-06-30",
      locationId: null,
    },
  });
  await dialog
    .getByRole("button", { name: "Cargar versión actual", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Monto (USD)", exact: true }),
  ).toHaveValue("470.00");
  await dialog
    .getByRole("textbox", { name: "Monto (USD)", exact: true })
    .fill("480");
  await dialog
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toMatchObject({
    method: "PUT",
    body: {
      expectedRevision: 2,
      expectedCurrencyCode: "USD",
      amountMinor: "48000",
      locationId: localId,
    },
  });
  expect(writes[1].body.operationId).not.toBe(writes[0].body.operationId);
  await page
    .getByRole("button", { name: "Editar Sueldo Luis", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Editar gasto", exact: true });
  await dialog
    .getByRole("button", { name: "Borrar gasto", exact: true })
    .click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Borrar gasto",
    exact: true,
  });
  expect(writes).toHaveLength(2);
  await confirmation
    .getByRole("button", { name: "Borrar gasto", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(writes[2]).toMatchObject({
    method: "DELETE",
    body: { expectedRevision: 3 },
  });
  await expect(
    page.getByText("No hay pagos en este rango.", { exact: true }),
  ).toBeVisible();
});
