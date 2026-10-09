import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-counter-harness.tsx",
    "pos",
  );
});
test.afterAll(async () => harness.close());
const order = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  tableLabel: "Mesa 4",
  status: "open",
  version: 1,
  location: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", name: "Centro" },
  business: { name: "Café de prueba", currencyCode: "USD" },
  items: [
    {
      lineId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      name: "Café",
      quantity: 2,
      unitPrice: "10.00",
      lineTotal: "20.00",
    },
  ],
  total: "20.00",
  createdAt: "2026-10-01T12:00:00Z",
  createdBy: "Ana",
  closedAt: null,
  closedBy: null,
  sale: null,
};
type PrinterQA = {
  requests: unknown[];
  active: boolean[];
  bytes: number[];
  writes: number;
  fail: string | null;
  hold: boolean;
  release?: () => void;
  browserPrint: string | null;
  printCount: number;
  oldTicket: boolean;
  disconnects: number;
};
async function fakePrinter(
  page: Page,
  mode: "ble" | "serial" | "unsupported",
  saved = false,
  fail: string | null = null,
  hold = false,
) {
  await page.addInitScript(
    ({ mode, saved, fail, hold }) => {
      const qa: PrinterQA = {
        requests: [],
        active: [],
        bytes: [],
        writes: 0,
        fail,
        hold,
        browserPrint: null,
        printCount: 0,
        oldTicket: false,
        disconnects: 0,
      };
      (window as unknown as { printerQA: PrinterQA }).printerQA = qa;
      if (saved)
        localStorage.setItem(
          "checkpass-printer",
          JSON.stringify({ transport: mode, name: "WD-58P1" }),
        );
      const ask = (options: unknown) => {
        qa.requests.push(options);
        qa.active.push(navigator.userActivation.isActive);
        if (qa.fail === "cancelled")
          throw new DOMException(
            "User cancelled the requestDevice() chooser",
            "NotFoundError",
          );
        if (qa.fail === "not_found")
          throw new DOMException("Printer missing", "NotFoundError");
      };
      const write = async (chunk: Uint8Array) => {
        qa.writes++;
        if (qa.fail === "write_failed") throw new Error("Device write failed");
        qa.bytes.push(...chunk);
        if (qa.hold)
          await new Promise<void>((resolve) => {
            qa.release = () => {
              qa.hold = false;
              resolve();
            };
          });
      };
      const characteristic = {
        properties: { write: true, writeWithoutResponse: true },
        writeValueWithResponse: write,
        writeValueWithoutResponse: write,
      };
      const device = {
        name: "WD-58P1",
        gatt: {
          connect: async () => ({
            getPrimaryService: async () => ({
              getCharacteristics: async () => [characteristic],
            }),
          }),
          disconnect: () => {
            qa.disconnects++;
          },
        },
      };
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value:
          mode === "ble"
            ? {
                requestDevice: async (options: unknown) => {
                  ask(options);
                  return device;
                },
              }
            : undefined,
      });
      let chosen = saved;
      const port = {
        open: async () => {},
        close: async () => {},
        writable: { getWriter: () => ({ write, releaseLock: () => {} }) },
      };
      Object.defineProperty(navigator, "serial", {
        configurable: true,
        value:
          mode === "serial"
            ? {
                getPorts: async () => (chosen ? [port] : []),
                requestPort: async (options: unknown) => {
                  ask(options);
                  chosen = true;
                  return port;
                },
              }
            : undefined,
      });
      window.print = () => {
        const ticket = document.querySelector(
          '[aria-label="Ticket de impresión"]',
        );
        qa.browserPrint = ticket?.textContent ?? null;
        qa.oldTicket = !!document.querySelector(
          '[aria-label="Ticket de la orden"]',
        );
        qa.printCount++;
      };
    },
    { mode, saved, fail, hold },
  );
}
const readQA = (page: Page) =>
  page.evaluate(() => {
    const {
      requests,
      active,
      bytes,
      writes,
      browserPrint,
      printCount,
      oldTicket,
      disconnects,
    } = (window as unknown as { printerQA: PrinterQA }).printerQA;
    return {
      requests,
      active,
      bytes,
      writes,
      browserPrint,
      printCount,
      oldTicket,
      disconnects,
    };
  });
async function setup(
  page: Page,
  settings = { showBusinessName: true, showTable: true },
) {
  const reads: string[] = [],
    writes: string[] = [];
  page.on("request", (request) => {
    if (!request.url().includes("/api/")) return;
    (request.method() === "GET" ? reads : writes).push(
      new URL(request.url()).pathname,
    );
  });
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "operator-1" },
        business: {
          id: "business-1",
          status: "active",
          posEnabled: true,
          currencyCode: "USD",
        },
        membership: { status: "active", permissions: ["pos"] },
      },
    }),
  );
  await page.route("**/api/pos/orders", (route) =>
    route.fulfill({
      json: {
        open: [{ ...order, itemCount: 2, saleTotal: null }],
        closedToday: [],
      },
    }),
  );
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) => route.fulfill({ json: order }),
  );
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: { products: [], categories: [], bestSellingProductIds: [] },
    }),
  );
  await page.route("**/api/pos/ticket", (route) =>
    route.fulfill({ json: settings }),
  );
  return { reads, writes };
}
async function open(page: Page) {
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Abrir Mesa 4", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Imprimir", exact: true }),
  ).toBeEnabled();
}

test("0185 precarga ajuste; BLE desde gesto, doble toque bloqueado y segunda impresión sin lista", async ({
  page,
}) => {
  const calls = await setup(page);
  await fakePrinter(page, "ble", true, null, true);
  await page.goto(harness.url);
  await expect
    .poll(() => calls.reads.filter((url) => url === "/api/pos/ticket").length)
    .toBe(1);
  await page.getByRole("button", { name: "Abrir Mesa 4", exact: true }).click();
  const print = page.getByRole("button", { name: "Imprimir", exact: true });
  await expect(print).toBeEnabled();
  const before = [...calls.reads];
  await print.click();
  await expect.poll(async () => (await readQA(page)).writes).toBe(1);
  await expect(print).toBeDisabled();
  await print.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  expect((await readQA(page)).requests).toHaveLength(1);
  expect((await readQA(page)).active).toEqual([true]);
  expect((await readQA(page)).requests[0]).toMatchObject({
    filters: [{ name: "WD-58P1" }],
  });
  await page.evaluate(() =>
    (window as unknown as { printerQA: PrinterQA }).printerQA.release?.(),
  );
  await expect(
    page.getByText("Ticket impreso", { exact: true }),
  ).toBeInViewport();
  await expect(print).toBeEnabled();
  await print.click();
  await expect(print).toBeEnabled();
  expect((await readQA(page)).requests).toHaveLength(1);
  expect(calls.reads).toEqual(before);
  expect(calls.writes).toEqual([]);
});

for (const mode of ["ble", "serial"] as const) {
  test(`0185 sin impresora permite elegir ${mode} desde gesto y reimprime`, async ({
    page,
  }) => {
    const calls = await setup(page);
    await fakePrinter(page, mode);
    await open(page);
    await page.getByRole("button", { name: "Imprimir", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Imprimir ticket",
      exact: true,
    });
    await expect(
      dialog.getByText("Elige la impresora antes de imprimir.", {
        exact: true,
      }),
    ).toBeVisible();
    expect((await readQA(page)).requests).toEqual([]);
    if (mode === "ble")
      await page.screenshot({
        path: "/private/tmp/0185-elegir-impresora.png",
        animations: "disabled",
      });
    await dialog
      .getByRole("button", { name: "Elegir impresora", exact: true })
      .click();
    await expect(
      page.getByText("Ticket impreso", { exact: true }),
    ).toBeVisible();
    expect((await readQA(page)).active).toEqual([true]);
    expect((await readQA(page)).writes).toBeGreaterThan(0);
    expect(calls.writes).toEqual([]);
  });
}

test("0185 impresora no encontrada muestra mensaje y Elegir otra olvida filtro anterior", async ({
  page,
}) => {
  await setup(page);
  await fakePrinter(page, "ble", true, "not_found");
  await open(page);
  await page.getByRole("button", { name: "Imprimir", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Imprimir ticket",
    exact: true,
  });
  await expect(
    dialog.getByText(
      "No encontramos la impresora. Revisa que este encendida y cerca, o elige otra.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { printerQA: PrinterQA }).printerQA.fail = null;
  });
  await dialog
    .getByRole("button", { name: "Elegir otra", exact: true })
    .click();
  await expect(page.getByText("Ticket impreso", { exact: true })).toBeVisible();
  expect((await readQA(page)).requests[1]).toMatchObject({
    acceptAllDevices: true,
  });
  expect((await readQA(page)).active).toEqual([true, true]);
});

for (const failure of ["cancelled", "write_failed"]) {
  test(`0185 ${failure} muestra mensaje del módulo y permite reintentar`, async ({
    page,
  }) => {
    await setup(page);
    await fakePrinter(page, "ble", true, failure);
    await open(page);
    await page.getByRole("button", { name: "Imprimir", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Imprimir ticket",
      exact: true,
    });
    const message =
      failure === "cancelled"
        ? "No se eligio ninguna impresora."
        : "No pudimos enviar el ticket a la impresora. Revisa que este encendida y vuelve a intentar.";
    await expect(dialog.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByText("Ticket impreso", { exact: true })).toHaveCount(
      0,
    );
    await page.evaluate(() => {
      (window as unknown as { printerQA: PrinterQA }).printerQA.fail = null;
    });
    await dialog
      .getByRole("button", { name: "Reintentar impresión", exact: true })
      .click();
    await expect(
      page.getByText("Ticket impreso", { exact: true }),
    ).toBeVisible();
  });
}

for (const showBusinessName of [false, true])
  for (const showTable of [false, true]) {
    test(`0185 unsupported dibuja TicketDoc ${showBusinessName}/${showTable} antes de window.print`, async ({
      page,
    }) => {
      const calls = await setup(page, { showBusinessName, showTable });
      await fakePrinter(page, "unsupported");
      await open(page);
      await page.getByRole("button", { name: "Imprimir", exact: true }).click();
      await expect.poll(async () => (await readQA(page)).printCount).toBe(1);
      const result = await readQA(page);
      expect(result.oldTicket).toBe(false);
      expect(result.browserPrint?.includes("Café de prueba")).toBe(
        showBusinessName,
      );
      expect(result.browserPrint?.includes("Mesa 4")).toBe(showTable);
      expect(result.browserPrint).toContain("Café");
      expect(result.browserPrint).toMatch(/2 × .*10/);
      expect(result.browserPrint).toMatch(/Total: .*20/);
      expect(result.browserPrint).toMatch(
        /\d{1,2}\/\d{1,2}\/\d{4} · \d{2}:\d{2}/,
      );
      expect(result.browserPrint).not.toMatch(/Precuenta|QR|Ana|Centro/);
      await page.emulateMedia({ media: "print" });
      const ticket = page.getByRole("region", {
        name: "Ticket de impresión",
        exact: true,
      });
      await expect(ticket).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Imprimir", exact: true }),
      ).toBeHidden();
      await expect(ticket.locator("svg, img, canvas")).toHaveCount(0);
      if (!showBusinessName && !showTable)
        await page.screenshot({
          path: "/private/tmp/0185-ticket-navegador.png",
          animations: "disabled",
        });
      expect(calls.writes).toEqual([]);
    });
  }

test("0185 ajuste pendiente bloquea imprimir; error reintenta sin defaults", async ({
  page,
}) => {
  await setup(page);
  await fakePrinter(page, "unsupported");
  let release!: () => void,
    attempts = 0;
  await page.route("**/api/pos/ticket", async (route) => {
    attempts++;
    if (attempts === 1) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return route.fulfill({
        status: 503,
        json: { error: "No se pudo cargar el ticket." },
      });
    }
    return route.fulfill({
      json: { showBusinessName: false, showTable: false },
    });
  });
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Abrir Mesa 4", exact: true }).click();
  const print = page.getByRole("button", { name: "Imprimir", exact: true });
  await expect(print).toBeDisabled();
  await expect.poll(() => typeof release).toBe("function");
  release();
  await expect(
    page.getByRole("heading", {
      name: "No se pudo cargar el ticket.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(print).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Reintentar configuración del ticket",
      exact: true,
    })
    .click();
  await expect(print).toBeEnabled();
  expect(attempts).toBe(2);
});

test("0185 autorización del ajuste revocada deja POS no disponible", async ({
  page,
}) => {
  await setup(page);
  await fakePrinter(page, "unsupported");
  await page.route("**/api/pos/ticket", (route) =>
    route.fulfill({
      status: 403,
      json: { code: "missing_permission", error: "Sin permiso POS." },
    }),
  );
  await page.goto(harness.url);
  await expect(
    page.getByRole("heading", { name: "POS no disponible", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Imprimir", exact: true }),
  ).toHaveCount(0);
});

test("0185 resultado de impresión tardío no aparece tras salir de la orden", async ({
  page,
}) => {
  await setup(page);
  await fakePrinter(page, "ble", true, null, true);
  await open(page);
  await page.getByRole("button", { name: "Imprimir", exact: true }).click();
  await expect.poll(async () => (await readQA(page)).writes).toBe(1);
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  await page.evaluate(() =>
    (window as unknown as { printerQA: PrinterQA }).printerQA.release?.(),
  );
  await expect(
    page.getByRole("heading", { name: "Abiertas", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await readQA(page)).disconnects).toBe(1);
  await expect(page.getByText("Ticket impreso", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("dialog", { name: "Imprimir ticket", exact: true }),
  ).toHaveCount(0);
});

test("0185 imprimir queda bloqueado para cambios sin guardar", async ({
  page,
}) => {
  const calls = await setup(page);
  await fakePrinter(page, "ble", true);
  await open(page);
  await page
    .getByRole("button", { name: "Añadir unidad de Café a 10.00", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Imprimir", exact: true }),
  ).toBeDisabled();
  expect((await readQA(page)).requests).toEqual([]);
  expect(calls.writes).toEqual([]);
});

test("0185 ajuste tardío no revive POS después de revocar la sesión", async ({
  page,
}) => {
  await setup(page);
  await fakePrinter(page, "unsupported");
  let release!: () => void;
  await page.route("**/api/pos/ticket", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: { showBusinessName: true, showTable: true } });
  });
  await page.route("**/api/pos/resolve", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "unauthorized", error: "Sesión revocada." },
    }),
  );
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Abrir Mesa 4", exact: true }).click();
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      "expired-session";
  });
  await expect(
    page.getByRole("heading", { name: "POS no disponible", exact: true }),
  ).toBeVisible();
  const response = page.waitForResponse("**/api/pos/ticket");
  release();
  await response;
  await expect(
    page.getByRole("button", { name: "Imprimir", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Reintentar configuración del ticket",
      exact: true,
    }),
  ).toHaveCount(0);
  expect((await readQA(page)).printCount).toBe(0);
});
