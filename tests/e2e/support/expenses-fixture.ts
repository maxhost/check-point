import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defineConfig, type Locator, type Page } from "@playwright/test";
import { startCatalogHarness } from "./catalog-harness-server";

// Runnable fixture config: no Next servers, credentials, database, retries or shared harness edits.
export default defineConfig({
  testDir: "..",
  testMatch: ["expenses.spec.ts", "expenses-input.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: path.resolve("test-results/expenses"),
  use: { browserName: "chromium", headless: true },
});

export const localId = "11111111-1111-4111-8111-111111111111";
export const secondLocalId = "22222222-2222-4222-8222-222222222222";
export const conceptId = "33333333-3333-4333-8333-333333333333";
export const expenseId = "44444444-4444-4444-8444-444444444444";
export const expenseContext = {
  currencyCode: "USD",
  minorUnit: 2,
  timeZone: "America/Guayaquil",
  defaultLocationId: localId,
  locations: [
    { id: localId, name: "Centro", status: "active" },
    { id: secondLocalId, name: "Norte", status: "active" },
  ],
  categories: [
    { id: "rent", label: "Alquiler" },
    { id: "gas", label: "Gas" },
    { id: "electricity", label: "Electricidad" },
    { id: "water", label: "Agua" },
    { id: "personnel", label: "Personal" },
    { id: "other", label: "Otro" },
  ],
};
export const concepts = [
  {
    id: conceptId,
    category: "personnel",
    name: "Luis",
    normalizedName: "luis",
  },
];
export const historicalExpense = {
  id: expenseId,
  revision: 1,
  revisionId: "55555555-5555-4555-8555-555555555555",
  paidOn: "2026-07-14",
  paymentTimeZone: "America/Guayaquil",
  amountMinor: "45000",
  currencyCode: "USD",
  minorUnit: 2,
  category: "personnel",
  conceptId,
  conceptName: "Luis",
  conceptNormalizedName: "luis",
  name: "Sueldo Luis",
  isFixed: true,
  locationId: localId,
  createdByUserId: "66666666-6666-4666-8666-666666666666",
  createdAt: "2026-07-15T02:00:00Z",
  updatedAt: "2026-07-15T02:00:00Z",
  deletedAt: null,
};
export const textDraft = {
  lines: [
    {
      paidOn: "2026-10-16",
      amountMinor: "45000",
      category: "personnel",
      conceptId,
      conceptName: "Luis",
      name: "Sueldo Luis",
      isFixed: true,
      locationId: localId,
      sourceText: "pagué a Luis 450",
    },
  ],
  unparsed: [] as string[],
};

export async function startExpensesHarness() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "expenses-ui-"));
  const entry = path.join(directory, "entry.tsx");
  const target = path.resolve(
    "apps/merchant/src/modules/expenses/ui/expenses-console.tsx",
  );
  await writeFile(
    entry,
    `import {createRoot} from "react-dom/client"; import {ExpensesConsole} from ${JSON.stringify(target)}; createRoot(document.getElementById("root")).render(<div className="backoffice-content"><ExpensesConsole /></div>);`,
  );
  try {
    const harness = await startCatalogHarness(entry, "expenses");
    return {
      ...harness,
      close: async () => {
        await harness.close();
        await rm(directory, { recursive: true });
      },
    };
  } catch (cause) {
    await rm(directory, { recursive: true });
    throw cause;
  }
}

export async function setupExpenses(
  page: Page,
  options: {
    role?: "owner" | "staff";
    permissions?: string[];
    defaultLocationId?: string | null;
    entries?: (typeof historicalExpense)[];
    currencyCode?: string;
    minorUnit?: 0 | 2;
    archived?: boolean;
  } = {},
) {
  await page.clock.install({ time: new Date("2026-10-17T03:00:00Z") });
  const reads: string[] = [];
  const role = options.role ?? "owner";
  const context = {
    ...expenseContext,
    ...("defaultLocationId" in options
      ? { defaultLocationId: options.defaultLocationId }
      : {}),
    ...(options.currencyCode
      ? {
          currencyCode: options.currencyCode,
          minorUnit: options.minorUnit ?? 2,
        }
      : {}),
  };
  if (options.archived) {
    context.locations = context.locations.map((entry) =>
      entry.id === localId ? { ...entry, status: "archived" } : entry,
    );
    context.defaultLocationId = secondLocalId;
  }
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        membership: { role, permissions: options.permissions ?? [] },
        business: {
          enabledModules: ["expenses"],
          timezone: context.timeZone,
          currencyCode: context.currencyCode,
        },
      },
    }),
  );
  await page.route("**/api/modules/expenses/context*", (route) => {
    reads.push(route.request().url());
    return route.fulfill({ json: context });
  });
  await page.route("**/api/modules/expenses/concepts", (route) => {
    reads.push(route.request().url());
    return route.fulfill({ json: { concepts } });
  });
  await page.route(/\/api\/modules\/expenses\/entries(?:\?|$)/, (route) => {
    reads.push(route.request().url());
    if (route.request().method() !== "GET")
      return route.fulfill({
        status: 500,
        json: { error: "Test: escritura no prevista." },
      });
    const query = new URL(route.request().url()).searchParams;
    const entries = (options.entries ?? []).filter(
      (entry) =>
        (!query.get("from") || entry.paidOn >= query.get("from")!) &&
        (!query.get("to") || entry.paidOn <= query.get("to")!) &&
        (!query.get("locationId") ||
          (query.get("locationId") === "business"
            ? entry.locationId === null
            : entry.locationId === query.get("locationId"))),
    );
    return route.fulfill({ json: { expenses: entries } });
  });
  return { reads, context };
}

export async function choose(
  page: Page,
  parent: Locator,
  label: string,
  option: string,
) {
  await parent.getByRole("button", { name: new RegExp(label) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function openRegistration(
  page: Page,
  url: string,
  method?: "Foto" | "Manual",
) {
  await page.goto(`${url}/backoffice/expenses`);
  await page
    .getByRole("button", { name: "Registrar gasto", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Registrar gasto",
    exact: true,
  });
  if (method)
    await dialog.getByRole("button", { name: method, exact: true }).click();
  return dialog;
}

export async function completeManual(page: Page, dialog: Locator) {
  const line = dialog.getByRole("region", { name: "Pago 1", exact: true });
  await choose(page, line, "Categoría", "Otro");
  await line
    .getByRole("textbox", { name: "Monto (USD)", exact: true })
    .fill("3,20");
  await line
    .getByRole("textbox", { name: "Qué pagaste", exact: true })
    .fill("Garrafa");
  await line
    .getByRole("button", { name: "Añadir detalle", exact: true })
    .click();
  await line
    .getByRole("textbox", { name: "Detalle (opcional)", exact: true })
    .fill("Compra de garrafa");
  return line;
}

export async function changePaymentLocation(
  page: Page,
  parent: Locator,
  option: string,
) {
  const change = parent.getByRole("button", {
    name: "Cambiar local",
    exact: true,
  });
  if (await change.count()) await change.click();
  await choose(page, parent, "Local del pago", option);
}

/** Type the actual accessible date segments, without assigning hidden input or React state. */
export async function setPaymentDay(page: Page, parent: Locator, day: string) {
  const [year, month, date] = day.split("-");
  for (const [name, value] of [
    [/año/i, year],
    [/mes/i, month],
    [/día/i, date],
  ] as const) {
    await parent.getByRole("spinbutton", { name }).focus();
    await page.keyboard.type(String(Number(value)));
  }
}

export async function expenseImage(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 1500;
    canvas.getContext("2d")!.fillRect(0, 0, 3000, 1500);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return {
    name: "pagos.png",
    mimeType: "image/png",
    buffer: Buffer.from(encoded, "base64"),
  };
}
