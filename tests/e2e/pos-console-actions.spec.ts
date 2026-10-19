import { test, expect, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  actionClosed,
  actionHistory,
  actionOpen,
} from "./support/pos-console-actions-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-console-actions-harness.tsx",
  );
});
test.afterAll(async () => {
  await harness.close();
});
async function setup(page: Page, mode = "normal") {
  const requests: {
    path: string;
    method: string;
    body: unknown;
    scope?: string;
  }[] = [];
  let order = structuredClone(actionOpen),
    voids = 0,
    tickets = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/modules/pos/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    expect(req.headers()["x-pos-contract"]).toBe("2");
    const scope = req.headers()["x-backoffice-scope"];
    expect(scope).toMatch(/^[ab]{64}$/);
    requests.push({
      path,
      method: req.method(),
      body: req.postDataJSON(),
      scope,
    });
    if (path.endsWith("ticket")) {
      tickets++;
      if (mode === "settings-error" && tickets === 1)
        return route.fulfill({
          status: 500,
          json: { error: "No pudimos cargar los ajustes." },
        });
      return route.fulfill({
        json: {
          printingEnabled: mode !== "disabled",
          showBusinessName: true,
          showTable: true,
        },
      });
    }
    if (path.endsWith("payment-methods"))
      return route.fulfill({
        json: {
          methods: [
            { id: "cash", name: "Efectivo", status: "active", isCash: true },
          ],
          defaultMethodId: "cash",
        },
      });
    if (req.method() === "GET") {
      if (path.endsWith("orders")) {
        if (
          mode === "initial-delay" &&
          requests.filter((r) => r.path.endsWith("orders")).length === 1
        )
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        const history = actionHistory();
        if (order.status !== "open") {
          history.open = [];
          history.closedToday.push({
            ...order,
            lineCount: order.items.length,
            saleTotal: order.total,
          });
        }
        return route.fulfill({ json: history });
      }
      return route.fulfill({
        json: path.endsWith(actionClosed.id) ? actionClosed : order,
      });
    }
    if (path.endsWith("close")) {
      order = {
        ...order,
        status: "closed",
        closedAt: new Date().toISOString(),
      };
      return route.fulfill({ json: order });
    }
    expect(path).toBe(`/api/modules/pos/orders/${actionOpen.id}/void`);
    voids++;
    if (mode === "late")
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    if (mode === "conflict" && voids === 1) {
      order = { ...order, version: 2, note: "Cambio concurrente" };
      return route.fulfill({
        status: 409,
        json: { code: "version_conflict", error: "La orden cambió", order },
      });
    }
    if (mode === "withdraw")
      return route.fulfill({ status: 401, json: { error: "Sesión retirada" } });
    if (mode === "scope")
      return route.fulfill({
        status: 409,
        json: {
          code: "backoffice_context_changed",
          error: "Contexto retirado",
        },
      });
    if (mode === "missing")
      return route.fulfill({
        status: 404,
        json: { error: "Pedido no encontrado" },
      });
    if (mode === "uncertain" && voids === 2)
      return route.fulfill({
        status: 403,
        json: { error: "Revisa tu acceso" },
      });
    order = { ...order, status: "voided", closedAt: new Date().toISOString() };
    if (mode === "uncertain" && voids === 1) return route.abort("failed");
    if (mode === "malformed" && voids === 1)
      return route.fulfill({ json: { ...order, id: "wrong-resource" } });
    return route.fulfill({ json: order });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(harness.url);
  return {
    requests,
    errors,
    paused: () => !!release,
    release: () => release?.(),
  };
}
async function open(page: Page) {
  await page
    .getByRole("button", { name: "Abrir Pedido abierto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pedido abierto", exact: true }),
  ).toBeVisible();
}
async function confirm(page: Page) {
  await page
    .getByRole("button", { name: "Anular pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar anulación", exact: true })
    .click();
}
function writes(state: Awaited<ReturnType<typeof setup>>) {
  return state.requests.filter((r) => r.method !== "GET");
}
async function selectStatus(page: Page, label: string) {
  await page.getByRole("button", { name: /Estado$/ }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
test("ticket preparation starts after usable list; precuenta, choose and retry do not write money", async ({
  page,
}) => {
  const state = await setup(page, "initial-delay");
  await expect.poll(state.paused).toBe(true);
  expect(state.requests.map((r) => r.path)).toEqual([
    "/api/modules/pos/orders",
  ]);
  state.release();
  await open(page);
  await page
    .getByRole("button", { name: "Imprimir precuenta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Elegir impresora", exact: true })
    .click();
  await expect(
    page.getByText("Impresora lista. Vuelve a imprimir el ticket.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => window.consoleActions.writes + window.consoleActions.browsers,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    window.consoleActions.fail = true;
  });
  await page
    .getByRole("button", { name: "Imprimir precuenta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reintentar impresión", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.consoleActions.fail = false;
  });
  await page
    .getByRole("button", { name: "Reintentar impresión", exact: true })
    .click();
  await expect(page.getByText("Ticket impreso", { exact: true })).toBeVisible();
  expect(writes(state)).toEqual([]);
  expect(state.errors).toEqual([]);
});
test("failed selection never prints and late selection cannot affect another order or identity", async ({
  page,
}) => {
  const state = await setup(page);
  await open(page);
  await page
    .getByRole("button", { name: "Imprimir precuenta", exact: true })
    .click();
  await page.evaluate(() => {
    window.consoleActions.chooseFail = true;
  });
  await page
    .getByRole("button", { name: "Elegir impresora", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reintentar impresión", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => window.consoleActions.browsers + window.consoleActions.writes,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Imprimir precuenta", exact: true })
    .click();
  await page.evaluate(() => {
    window.consoleActions.chooseFail = false;
    window.consoleActions.delay = 200;
  });
  await page
    .getByRole("button", { name: "Elegir impresora", exact: true })
    .click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("actions-identity")),
  );
  await expect(
    page.getByRole("button", { name: "Nueva orden", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(250);
  await expect(
    page.getByText("Impresora lista. Vuelve a imprimir el ticket.", {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => window.consoleActions.browsers + window.consoleActions.writes,
    ),
  ).toBe(0);
  expect(writes(state)).toEqual([]);
});
test("result and closed reprint preserve canonical closed sale without another close", async ({
  page,
}) => {
  const state = await setup(page);
  await open(page);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Venta completada", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: undefined,
    }),
  );
  await page
    .getByRole("button", { name: "Reimprimir ticket", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.consoleActions.browsers))
    .toBe(1);
  await page
    .getByRole("button", { name: "Volver al listado", exact: true })
    .click();
  await selectStatus(page, "Cerradas hoy");
  await page
    .getByRole("button", { name: "Abrir Pedido cerrado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reimprimir ticket", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.consoleActions.browsers))
    .toBe(2);
  await expect(
    page.getByRole("button", { name: "Anular pedido", exact: true }),
  ).toHaveCount(0);
  expect(writes(state).map((r) => r.path)).toEqual([
    `/api/modules/pos/orders/${actionOpen.id}/close`,
  ]);
  expect(state.requests.filter((r) => r.path.endsWith("orders"))).toHaveLength(
    1,
  );
});
for (const mode of ["disabled", "settings-error"])
  test(`printing ${mode} keeps sale actions usable`, async ({ page }) => {
    const state = await setup(page, mode);
    await open(page);
    if (mode === "settings-error") {
      await page
        .getByRole("button", {
          name: "Reintentar configuración del ticket",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", { name: "Imprimir precuenta", exact: true }),
      ).toBeEnabled();
    } else
      await expect(
        page.getByRole("button", { name: "Imprimir precuenta", exact: true }),
      ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cobrar", exact: true }),
    ).toBeEnabled();
    expect(writes(state)).toEqual([]);
  });
test("cancel does not write; double confirm applies canonical void to same list without GET", async ({
  page,
}) => {
  const state = await setup(page);
  await open(page);
  await page
    .getByRole("button", { name: "Anular pedido", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes(state)).toEqual([]);
  await page
    .getByRole("button", { name: "Anular pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar anulación", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Orden anulada", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cobrar", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Volver al listado", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Abrir Pedido abierto", exact: true }),
  ).toHaveCount(0);
  await selectStatus(page, "Anuladas hoy");
  await page
    .getByRole("button", { name: "Abrir Pedido abierto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Orden anulada", exact: true }),
  ).toBeVisible();
  expect(writes(state).map((r) => r.body)).toEqual([
    { version: actionOpen.version },
  ]);
  expect(
    state.requests.filter(
      (r) => r.method === "GET" && !r.path.endsWith("ticket"),
    ),
  ).toHaveLength(2);
});
test("lost void response retains same intent through remount and 403 until explicit recovery", async ({
  page,
}) => {
  const state = await setup(page, "uncertain");
  await open(page);
  await confirm(page);
  await expect(
    page.getByRole("button", {
      name: "Reintentar la misma anulación",
      exact: true,
    }),
  ).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event("actions-remount")));
  await expect(
    page.getByRole("button", { name: "Volver al listado", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Cobrar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Editar pedido", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reintentar la misma anulación", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Reintentar la misma anulación",
      exact: true,
    }),
  ).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("actions-remount")));
  await expect(
    page.getByRole("button", {
      name: "Reintentar la misma anulación",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Comprobar acceso", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Volver al listado", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reintentar la misma anulación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Orden anulada", exact: true }),
  ).toBeVisible();
  const attempts = writes(state);
  expect(attempts).toHaveLength(3);
  expect(
    attempts.every(
      (r) =>
        JSON.stringify(r.body) === JSON.stringify(attempts[0].body) &&
        r.scope === attempts[0].scope,
    ),
  ).toBe(true);
  expect(state.requests.filter((r) => r.path.endsWith("orders"))).toHaveLength(
    2,
  );
  expect(state.errors).toEqual([]);
});
for (const mode of [
  "conflict",
  "malformed",
  "missing",
  "withdraw",
  "scope",
  "late",
])
  test(`void ${mode} recovery preserves ownership`, async ({ page }) => {
    const state = await setup(page, mode);
    await open(page);
    await confirm(page);
    if (mode === "conflict") {
      await expect(
        page.getByRole("button", { name: "Cobrar", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Revisar orden actual", exact: true })
        .click();
      await expect(
        page.getByText("Cambio concurrente", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Cobrar", exact: true }),
      ).toBeEnabled();
    } else if (mode === "malformed") {
      await expect(
        page.getByRole("button", { name: "Volver al listado", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", {
          name: "Reintentar la misma anulación",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("heading", { name: "Orden anulada", exact: true }),
      ).toBeVisible();
      expect(writes(state)[0].body).toEqual(writes(state)[1].body);
    } else if (mode === "missing") {
      await expect(
        page.getByRole("button", { name: "Nueva orden", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", { name: "Abrir Pedido abierto", exact: true }),
      ).toHaveCount(0);
    } else if (mode === "late") {
      await expect.poll(state.paused).toBe(true);
      await page.evaluate(() =>
        window.dispatchEvent(new Event("actions-identity")),
      );
      state.release();
      await expect(
        page.getByRole("button", { name: "Nueva orden", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByRole("heading", { name: "Orden anulada", exact: true }),
      ).toHaveCount(0);
    } else {
      await expect(
        page.getByRole("button", { name: "Cobrar", exact: true }),
      ).toBeDisabled();
      await page.evaluate(() =>
        window.dispatchEvent(new Event("actions-identity")),
      );
      await expect(
        page.getByRole("button", { name: "Nueva orden", exact: true }),
      ).toBeEnabled();
    }
    expect(writes(state).every((r) => r.path.endsWith("/void"))).toBe(true);
    expect(writes(state)).toHaveLength(mode === "malformed" ? 2 : 1);
  });
test("grouped open detail and confirmation inspection at 390 and 1280", async ({
  page,
}) => {
  await setup(page);
  await open(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/private/tmp/checkpass-pos-0242/console-actions/detail-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Anular pedido", exact: true })
      .click();
    await page.screenshot({
      path: `/private/tmp/checkpass-pos-0242/console-actions/confirm-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  }
});
