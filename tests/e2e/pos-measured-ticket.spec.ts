import { test, expect, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-measured-ticket-harness.tsx",
  );
});
test.afterAll(async () => {
  await harness.close();
});
async function open(page: Page, query = "", mode = "ok") {
  const requests: {
    method: string;
    url: string;
    contract?: string;
    scope?: string;
  }[] = [];
  await page.route("**/api/modules/pos/**", async (route) => {
    const request = route.request();
    requests.push({
      method: request.method(),
      url: request.url(),
      contract: request.headers()["x-pos-contract"],
      scope: request.headers()["x-backoffice-scope"],
    });
    await route.fulfill(
      mode === "error" && requests.length === 1
        ? { status: 500, json: { error: "No pudimos cargar los ajustes." } }
        : {
            json: {
              printingEnabled: mode !== "disabled",
              showBusinessName: true,
              showTable: true,
            },
          },
    );
  });
  await page.goto(harness.url + query);
  await expect(
    page
      .getByRole("heading", {
        name: /Precuenta|Venta cerrada|Orden anulada/,
        exact: true,
      })
      .first(),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Preparar ticket", exact: true })
    .click();
  return requests;
}
async function ready(page: Page) {
  await expect(
    page.getByRole("button", {
      name: /Imprimir precuenta|Reimprimir ticket/,
      exact: true,
    }),
  ).toBeEnabled();
}
test("explicit preparation scopes a single GET; unsupported fallback shares the prepared exact doc", async ({
  page,
}) => {
  const requests = await open(page, "?unsupported");
  await ready(page);
  // The exact document is print-only; the on-screen receipt formats money separately.
  await expect(
    page.getByText("0.123456789 kg × 12.123456789 USD/lb", { exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Imprimir precuenta", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.ticketTest.browsers))
    .toBe(1);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    method: "GET",
    contract: "2",
    scope: "a".repeat(64),
  });
});
test("selection stays in gesture and requires another explicit gesture to print; double tap is locked", async ({
  page,
}) => {
  const requests = await open(page);
  await ready(page);
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
  expect(await page.evaluate(() => window.ticketTest.writes)).toBe(0);
  await page
    .getByRole("button", { name: "Imprimir precuenta", exact: true })
    .dblclick();
  await expect(page.getByText("Ticket impreso", { exact: true })).toBeVisible();
  const writes = await page.evaluate(() => window.ticketTest.writes);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.ticketTest.writes)).toBe(writes);
  expect(await page.evaluate(() => window.ticketTest.gestures)).toEqual([true]);
  // An async suspension before the transport would show `at async choose`.
  expect(await page.evaluate(() => window.ticketTest.stacks[0])).toMatch(
    /at choose \(/,
  );
  expect(
    requests.every(
      (request) => request.method === "GET" && request.url.endsWith("/ticket"),
    ),
  ).toBe(true);
});
for (const failure of ["unsupported", "cancelled", "write_failed"]) {
  test(`${failure} selection never prints; a separate retry gesture can use fallback`, async ({
    page,
  }) => {
    const requests = await open(page);
    await ready(page);
    await page
      .getByRole("button", { name: "Imprimir precuenta", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Elegir impresora", exact: true }),
    ).toBeVisible();
    await page.evaluate((reason) => {
      Object.defineProperty(navigator, "bluetooth", {
        configurable: true,
        value:
          reason === "unsupported"
            ? undefined
            : {
                requestDevice() {
                  return Promise.reject(
                    reason === "cancelled"
                      ? new DOMException(
                          "User cancelled the requestDevice() chooser",
                          "NotFoundError",
                        )
                      : new Error("selection failed"),
                  );
                },
              },
      });
    }, failure);
    await page
      .getByRole("button", { name: "Elegir impresora", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Reintentar impresión", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => ({
        browsers: window.ticketTest.browsers,
        writes: window.ticketTest.writes,
      })),
    ).toEqual({ browsers: 0, writes: 0 });
    // Support is absent now; only the next explicit print gesture may fall back.
    await page.evaluate(() =>
      Object.defineProperty(navigator, "bluetooth", {
        value: undefined,
        configurable: true,
      }),
    );
    await page
      .getByRole("button", { name: "Reintentar impresión", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.ticketTest.browsers))
      .toBe(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("GET");
  });
}
test("cancel and write failure can retry without issuing sale commands", async ({
  page,
}) => {
  const requests = await open(page, "?saved&closed&pass");
  await ready(page);
  await expect(
    page.getByText("Acreditación: 5 puntos", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Saldo: 18 puntos", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Extras: 2 puntos", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.ticketTest.mode = "cancelled";
  });
  await page
    .getByRole("button", { name: "Reimprimir ticket", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => {
    window.ticketTest.mode = "write_failed";
  });
  await page
    .getByRole("button", { name: "Reintentar impresión", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No pudimos enviar el ticket",
  );
  await page.evaluate(() => {
    window.ticketTest.mode = "ok";
  });
  await page
    .getByRole("button", { name: "Reintentar impresión", exact: true })
    .click();
  await expect(page.getByText("Ticket impreso", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  await expect(
    page.getByText("Saldo: 18 puntos", { exact: true }),
  ).toBeVisible();
});
test("anonymous closed result and voided ticket keep their actual status", async ({
  page,
}) => {
  await open(page, "?closed&unsupported");
  await ready(page);
  await expect(
    page.getByText("Venta cerrada sin pase.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reimprimir ticket", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.ticketTest.browsers))
    .toBe(1);
  await page.goto(harness.url + "?voided&unsupported");
  await page
    .getByRole("button", { name: "Preparar ticket", exact: true })
    .click();
  await ready(page);
  await expect(
    page.getByText(
      "Esta orden está anulada. Su ticket no acredita una venta.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Venta cerrada", exact: true }),
  ).toHaveCount(0);
});
test("configuration error retries explicitly and disabled printing remains visible", async ({
  page,
}) => {
  const requests = await open(page, "", "error");
  await page
    .getByRole("button", {
      name: "Reintentar configuración del ticket",
      exact: true,
    })
    .click();
  await ready(page);
  expect(requests).toHaveLength(2);
  await page.unrouteAll();
  await open(page, "", "disabled");
  await expect.poll(() => requests.length).toBe(2);
  await expect(
    page.getByRole("button", {
      name: /Imprimir precuenta|Reimprimir ticket/,
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByText("Impresión desactivada en los ajustes del POS", {
      exact: true,
    }),
  ).toBeVisible();
});
for (const change of ["identity", "order", "version", "status", "unmount"]) {
  test(`retired ${change} callbacks cannot access a device or open browser printing`, async ({
    page,
  }) => {
    await open(page, "?unsupported");
    await ready(page);
    await expect
      .poll(() => page.evaluate(() => !!window.ticketTest.stale))
      .toBe(true);
    await page.evaluate((event) => {
      document.dispatchEvent(new Event(`test-${event}`));
      void window.ticketTest.stale!.print();
      void window.ticketTest.stale!.choose();
    }, change);
    await page.waitForTimeout(80);
    expect(
      await page.evaluate(() => ({
        choices: window.ticketTest.choices,
        browsers: window.ticketTest.browsers,
      })),
    ).toEqual({ choices: 0, browsers: 0 });
  });
}
test("late selection after identity change does not chain print or restore stale feedback", async ({
  page,
}) => {
  await open(page);
  await ready(page);
  await page
    .getByRole("button", { name: "Imprimir precuenta", exact: true })
    .click();
  await page.evaluate(() => {
    window.ticketTest.delay = 180;
  });
  await page
    .getByRole("button", { name: "Elegir impresora", exact: true })
    .click();
  await page.evaluate(() => document.dispatchEvent(new Event("test-identity")));
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(
      () => window.ticketTest.writes + window.ticketTest.browsers,
    ),
  ).toBe(0);
  await expect(
    page.getByText("Impresora lista. Vuelve a imprimir el ticket.", {
      exact: true,
    }),
  ).toHaveCount(0);
});
test("late unsupported result after selection retirement cannot open print", async ({
  page,
}) => {
  await open(page, "?unsupported");
  await ready(page);
  await expect
    .poll(() => page.evaluate(() => !!window.ticketTest.stale))
    .toBe(true);
  await page.evaluate(() => {
    void window.ticketTest.stale!.print();
    document.dispatchEvent(new Event("test-order"));
  });
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.ticketTest.browsers)).toBe(0);
});

test("grouped ticket inspection phone and desktop", async ({ page }) => {
  await open(page, "?closed&pass&unsupported");
  await ready(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
