import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  connectedCatalog,
  connectedOrder,
} from "./support/pos-connected-console-fixture";
import type { PosOrderV2 } from "../../apps/merchant/src/modules/pos/contracts";
const native = process.env.POS_CONNECTED_NATIVE === "true";
async function select(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: new RegExp(label + "$") }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function add(page: Page, name = "Café", pickup = false) {
  const create = page.getByRole("button", { name: "Nueva orden", exact: true });
  if (await create.isVisible()) await create.click();
  else {
    // The content-only harness has no shell mobile bar: deliver the same manifest action.
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("checkpass:module-primary", {
          detail: { moduleId: "pos" },
        }),
      ),
    );
  }
  await page
    .getByRole("button", {
      name: pickup ? "Para retirar" : "Mostrador",
      exact: true,
    })
    .click();
  if (pickup) {
    await page
      .getByRole("textbox", { name: "Nombre o referencia", exact: true })
      .fill("Ana");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await page
    .getByRole("button", { name: `Añadir ${name}`, exact: true })
    .click();
}
if (!native) {
  let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
  test.beforeAll(async () => {
    harness = await startCatalogHarness(
      "tests/e2e/support/pos-connected-console-harness.tsx",
    );
  });
  test.afterAll(async () => {
    await harness.close();
  });
  async function setup(page: Page, mode = "normal") {
    let order: PosOrderV2 | null = null;
    const writes: { method: string; body: unknown; path: string }[] = [];
    let releaseLate: (() => void) | undefined;
    let reads = 0,
      closes = 0;
    await page.route("**/api/modules/pos/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      expect(req.headers()["x-pos-contract"]).toBe("2");
      expect(req.headers()["x-backoffice-scope"]).toBeTruthy();
      if (path.endsWith("catalog"))
        return route.fulfill({ json: connectedCatalog });
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
          reads++;
          return route.fulfill({
            json: {
              open:
                order?.status === "open"
                  ? [
                      {
                        ...order,
                        lineCount: order.items.length,
                        saleTotal: null,
                      },
                    ]
                  : [],
              closedToday: [],
            },
          });
        }
        return route.fulfill({ json: order });
      }
      const body = req.postDataJSON();
      if (mode === "late" && req.method() === "POST" && path.endsWith("orders"))
        await new Promise<void>((resolve) => {
          releaseLate = resolve;
        });
      writes.push({ method: req.method(), body, path });
      if (path.endsWith("close")) {
        closes++;
        if (mode === "uncertain" && closes === 1) return route.abort("failed");
        order = {
          ...order!,
          status: "closed",
          closedAt: new Date().toISOString(),
          total: "2.00",
        };
        return route.fulfill({ json: order });
      }
      if (
        mode === "conflict" &&
        req.method() === "PUT" &&
        writes.filter((w) => w.method === "PUT").length === 1
      )
        return route.fulfill({
          status: 409,
          json: {
            code: "version_conflict",
            error: "La orden cambió",
            order: { ...order!, version: 2, note: "Cambio de otra persona" },
          },
        });
      order = {
        ...connectedOrder,
        saleType: body.saleType,
        orderLabel: body.orderLabel || "Mostrador 1",
        version: req.method() === "PUT" ? 2 : 1,
        items: body.items.map(
          (line: { productId: string; quantity: string }, i: number) => ({
            lineId: `line-${i}`,
            productId: line.productId,
            name: "Café",
            quantity: line.quantity,
            unitPrice: "2.00",
            lineTotal: "2.00",
            measure: {
              kind: "unit",
              priceUnit: "unit",
              quantityUnit: "unit",
              conversionVersion: "mass-si-1",
            },
          }),
        ),
      };
      return route.fulfill({ json: order });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(harness.url);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    return {
      writes,
      counts: () => ({ reads, closes }),
      release: () => releaseLate?.(),
      paused: () => !!releaseLate,
    };
  }
  test("Mostrador connects create, cancel, recover same close, result and canonical list without GET", async ({
    page,
  }) => {
    const state = await setup(page, "uncertain");
    await add(page);
    await page
      .getByRole("button", { name: "Continuar al cobro", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cobrar", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Cobrar", exact: true }).click();
    await page
      .getByRole("button", { name: "Confirmar cobro", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Salir", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Reintentar el mismo cobro", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Venta cerrada", exact: true }),
    ).toBeVisible();
    const closing = state.writes.filter((w) => w.path.endsWith("close"));
    expect(closing).toHaveLength(2);
    expect(closing[0].body).toEqual(closing[1].body);
    expect(
      state.writes.filter(
        (w) => w.method === "POST" && w.path.endsWith("orders"),
      ),
    ).toHaveLength(1);
    await page
      .getByRole("button", { name: "Volver al historial", exact: true })
      .click();
    await select(page, "Estado", "Cerradas hoy");
    await expect(
      page.getByRole("button", { name: "Abrir Mostrador 1" }),
    ).toBeVisible();
    expect(state.counts().reads).toBe(1);
  });
  test("save a pickup, return and reopen canonical order", async ({ page }) => {
    const state = await setup(page);
    await add(page, "Café", true);
    await page
      .getByRole("button", {
        name: /Confirmar orden|Guardar cambios/,
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Pedido guardado", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await page.getByRole("button", { name: "Abrir Ana", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Ana", exact: true }),
    ).toBeVisible();
    expect(state.counts().reads).toBe(1);
  });
  test("conflict keeps the draft and requires explicit review", async ({
    page,
  }) => {
    const state = await setup(page, "conflict");
    await add(page, "Café", true);
    await page
      .getByRole("button", {
        name: /Confirmar orden|Guardar cambios/,
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Pedido guardado", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: /Añadir nota al pedido|Editar nota del pedido/,
      })
      .click();
    await page
      .getByRole("textbox", { name: "Nota del pedido", exact: true })
      .fill("Mi intención");
    await page.getByRole("button", { name: "Listo", exact: true }).click();
    await page
      .getByRole("button", {
        name: /Confirmar orden|Guardar cambios/,
        exact: true,
      })
      .click();
    await expect(
      page.getByText("El pedido cambió. Revisa antes de continuar.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Confirmar orden|Guardar cambios/,
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "He revisado la orden actual; conservar mi borrador",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Editar nota del pedido", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Nota del pedido", exact: true }),
    ).toHaveValue("Mi intención");
    await page.getByRole("button", { name: "Listo", exact: true }).click();
    await page
      .getByRole("button", {
        name: /Confirmar orden|Guardar cambios/,
        exact: true,
      })
      .click();
    expect(state.writes.filter((w) => w.method === "PUT")).toHaveLength(2);
  });
  test("identity A to B discards a late create callback", async ({ page }) => {
    const state = await setup(page, "late");
    await add(page);
    await page
      .getByRole("button", { name: "Continuar al cobro", exact: true })
      .click();
    await expect.poll(() => state.paused()).toBe(true);
    // The fixture pauses delivery before recording its old response; identity changes externally.
    await page.evaluate(() =>
      window.dispatchEvent(new Event("connected-context-change")),
    );
    state.release();
    await expect.poll(() => state.writes.length).toBe(1);
    await expect(
      page.getByRole("button", { name: "Nueva orden", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("heading", { name: "Venta cerrada", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Confirmar cobro", exact: true }),
    ).toHaveCount(0);
  });
  for (const width of [390, 1280])
    test(`connected list and editor at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await setup(page);
      await add(page);
      await expect(
        page.getByRole("heading", { name: "Nuevo pedido", exact: true }),
      ).toBeAttached();
      await expect(
        page.getByRole("button", {
          name: "Editar mesa u orden: Mostrador",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("button", { name: "Continuar al cobro", exact: true }),
      ).toBeEnabled();
    });
} else {
  test("native Next/auth/HTTP/DB unit sale", async ({ page, context }) => {
    const fixture = JSON.parse(
      await readFile(
        "/private/tmp/checkpass-pos-0242/connected-console/native-private.json",
        "utf8",
      ),
    );
    const pair = fixture.worlds[0].ownerCookie as string,
      at = pair.indexOf("=");
    await context.addCookies([
      {
        name: pair.slice(0, at),
        value: pair.slice(at + 1),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const paths: { path: string; method: string }[] = [];
    page.on("request", (req) => {
      if (new URL(req.url()).pathname.startsWith("/api/"))
        paths.push({ path: new URL(req.url()).pathname, method: req.method() });
    });
    await page.goto("http://localhost:43252/backoffice/pos?posV2=1");
    await add(page, "Medialuna");
    await page
      .getByRole("button", { name: "Continuar al cobro", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar cobro", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Venta cerrada", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Volver al historial", exact: true })
      .click();
    await select(page, "Estado", "Cerradas hoy");
    await expect(
      page.getByRole("button", { name: /Abrir Mostrador/ }),
    ).toBeVisible();
    expect(
      paths.filter((p) => p.path.endsWith("/close") && p.method === "POST"),
    ).toHaveLength(1);
    expect(
      paths.filter(
        (p) => p.path === "/api/modules/pos/orders" && p.method === "GET",
      ),
    ).toHaveLength(1);
    expect(
      paths.filter((p) =>
        ["/api/merchant/session", "/api/business/modules"].includes(p.path),
      ),
    ).toHaveLength(0);
    // A new command from the old document must reject before touching either business.
    await page
      .getByRole("button", { name: "Nueva orden", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Añadir Medialuna", exact: true })
      .click();
    const b = fixture.worlds[1].ownerCookie as string,
      cut = b.indexOf("=");
    const observer = await context.newCDPSession(page);
    let rejectedCode: string | undefined;
    await observer.send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/modules/pos/orders", requestStage: "Response" },
      ],
    });
    observer.on("Fetch.requestPaused", async (event) => {
      try {
        if (
          event.request.method === "POST" &&
          event.responseStatusCode === 409
        ) {
          const body = await observer.send("Fetch.getResponseBody", {
            requestId: event.requestId,
          });
          rejectedCode = JSON.parse(
            body.base64Encoded
              ? Buffer.from(body.body, "base64").toString("utf8")
              : body.body,
          ).code;
        }
      } finally {
        await observer
          .send("Fetch.continueResponse", { requestId: event.requestId })
          .catch(() => {});
      }
    });
    await context.addCookies([
      {
        name: b.slice(0, cut),
        value: b.slice(cut + 1),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const stale = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/modules/pos/orders" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Continuar al cobro", exact: true })
      .click();
    expect((await stale).status()).toBe(409);
    await expect.poll(() => rejectedCode).toBe("backoffice_context_changed");
    await page.waitForURL("http://localhost:43252/backoffice");
  });
}
