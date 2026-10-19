import { test, expect, type Page } from "@playwright/test";
import { buildFinancialAmountsFromSnapshots } from "../../packages/domain/src/financial";
import type {
  PosLineV2,
  PosCreateV2,
  PosUpdateV2,
} from "../../apps/merchant/src/modules/pos/contracts";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  editorCatalog,
  editorOrder,
} from "./support/pos-measured-editor-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-measured-editor-harness.tsx",
  );
});
test.afterAll(async () => {
  await harness.close();
});
async function closeDetails(page: Page) {
  const done = page.getByRole("button", { name: "Listo", exact: true });
  if (await done.isVisible()) await done.click();
}
async function noteField(page: Page) {
  const field = page.getByRole("textbox", {
    name: "Nota del pedido",
    exact: true,
  });
  if (!(await field.isVisible())) {
    const edit = page.getByRole("button", {
      name: /Añadir nota al pedido|Editar nota del pedido/,
    });
    if (await edit.isVisible()) await edit.click();
    else {
      await page
        .getByRole("button", { name: "Opciones de la orden", exact: true })
        .click();
      await page.getByRole("button", { name: "Notas", exact: true }).click();
    }
  }
  return field;
}
async function select(page: Page, label: string, value: string) {
  await closeDetails(page);
  if (label === "Local")
    await page.getByRole("button", { name: /^Editar local:/ }).click();
  if (label === "Tipo de venta")
    await page.getByRole("button", { name: /^Editar mesa u orden:/ }).click();
  await page
    .getByRole("button", { name: new RegExp(label + "$"), exact: false })
    .click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function mock(page: Page, mode = "normal") {
  const catalog =
    mode === "cop"
      ? {
          ...editorCatalog,
          products: editorCatalog.products.map((product) => ({
            ...product,
            unitPrice: product.id === "coffee" ? "0.49" : product.unitPrice,
          })),
        }
      : editorCatalog;
  const requests: {
    method: string;
    body: PosCreateV2 | PosUpdateV2;
    scope: string | null;
    contract: string | null;
  }[] = [];
  await page.route("**/api/modules/pos/**", async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes("/catalog?")) {
      await route.fulfill({ json: catalog });
      return;
    }
    if (url.includes("/tables?")) {
      await route.fulfill({
        json: { tables: [{ id: "table1", name: "Mesa 1", openOrderId: null }] },
      });
      return;
    }
    const body = req.postDataJSON() as PosCreateV2 | PosUpdateV2;
    requests.push({
      method: req.method(),
      body,
      scope: req.headers()["x-backoffice-scope"] ?? null,
      contract: req.headers()["x-pos-contract"] ?? null,
    });
    if (mode === "lost" && requests.length === 1) {
      await route.abort("failed");
      return;
    }
    if (mode === "version" && requests.length === 1) {
      await route.fulfill({
        status: 409,
        json: {
          code: "version_conflict",
          error: "La orden cambió",
          order: { ...editorOrder, version: 2, note: "Nota de otra persona" },
        },
      });
      return;
    }
    if (mode === "catalog" && requests.length === 1) {
      await route.fulfill({
        status: 409,
        json: {
          code: "catalog_changed",
          error: "El catálogo cambió",
          products: [
            {
              ...editorCatalog.products[0],
              unitPrice: "7",
              catalogRevision: "9",
            },
          ],
        },
      });
      return;
    }
    if (mode === "late")
      await new Promise((resolve) => setTimeout(resolve, 400));
    const items: PosLineV2[] = body.items.map((item, index: number) => {
      const old = item.lineId
        ? editorOrder.items.find((line) => line.lineId === item.lineId)
        : null;
      const product = catalog.products.find((p) => p.id === item.productId)!;
      const measure =
        old?.measure ??
        (product.soldByWeight
          ? {
              kind: "mass" as const,
              quantityUnit: item.quantityUnit,
              priceUnit: product.pricingUnit as "kg" | "lb" | "g",
              conversionVersion: "mass-si-1" as const,
            }
          : {
              kind: "unit" as const,
              quantityUnit: "unit" as const,
              priceUnit: "unit" as const,
              conversionVersion: "mass-si-1" as const,
            });
      const line = {
        lineId: item.lineId || `line-${index}`,
        productId: item.productId,
        name: old?.name ?? product.name,
        unitPrice:
          old?.unitPrice ?? (mode === "catalog" ? "7" : product.unitPrice!),
        quantity: item.quantity,
        measure: { ...measure, quantityUnit: item.quantityUnit },
        lineTotal: "0",
      };
      return line;
    });
    const currencyCode =
      mode === "cop" ? "COP" : editorOrder.business.currencyCode;
    const amounts = items.length
      ? buildFinancialAmountsFromSnapshots({
          currencyCode,
          discount: null,
          lines: items.map((line, position) => ({
            sourceLineId: line.lineId,
            position,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            measure: line.measure,
          })),
        })
      : null;
    const total = amounts?.gross ?? "0.00";
    items.forEach((line) => {
      line.lineTotal = amounts!.lines.find(
        (financial) => financial.sourceLineId === line.lineId,
      )!.money.gross;
    });
    await route.fulfill({
      json: {
        ...editorOrder,
        business: { ...editorOrder.business, currencyCode },
        status: mode === "closed" ? "closed" : "open",
        version: 2,
        saleType: body.saleType,
        orderLabel: body.orderLabel || "Mostrador 42",
        tableId: body.tableId,
        location: { id: body.locationId, name: "Local Norte" },
        note: body.note,
        items,
        total,
      },
    });
  });
  return requests;
}
async function start(page: Page, suffix = "") {
  await page.goto(harness.url + suffix);
  if (!suffix.includes("existing")) await select(page, "Local", "Local Norte");
}
test("cuatro tipos, mesa real, local y guardar canónico sin GET extra", async ({
  page,
}) => {
  const requests = await mock(page);
  await start(page, "?tables");
  await select(page, "Tipo de venta", "Mesa");
  await page.getByRole("button", { name: "Mesa 1 · Libre" }).click();
  await closeDetails(page);
  await page
    .getByRole("button", {
      name: /Confirmar orden|Guardar cambios/,
      exact: true,
    })
    .click();
  await expect(page.getByRole("status", { name: "Guardado" })).toContainText(
    "table1",
  );
  await select(page, "Tipo de venta", "Para retirar");
  await page
    .getByRole("textbox", { name: "Nombre o referencia" })
    .fill("Retiro Ana");
  await closeDetails(page);
  await page
    .getByRole("button", {
      name: /Confirmar orden|Guardar cambios/,
      exact: true,
    })
    .click();
  await expect(page.getByRole("status", { name: "Guardado" })).toContainText(
    "Retiro Ana",
  );
  await select(page, "Tipo de venta", "Delivery");
  await page
    .getByRole("textbox", { name: "Nombre o referencia" })
    .fill("Delivery Luis");
  await closeDetails(page);
  await page
    .getByRole("button", {
      name: /Confirmar orden|Guardar cambios/,
      exact: true,
    })
    .click();
  await expect(page.getByRole("status", { name: "Guardado" })).toContainText(
    "Delivery Luis",
  );
  expect(requests.map((r) => r.method)).toEqual(["POST", "PUT", "PUT"]);
  expect(requests.every((r) => r.contract === "2")).toBe(true);
});
test("captura mass vacía, cero/null, nota, vistas y Mostrador interno", async ({
  page,
}) => {
  const requests = await mock(page);
  await page.setViewportSize({ width: 390, height: 950 });
  await start(page);
  await expect(
    page.getByRole("button", { name: "Añadir Sin precio", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Añadir Café en grano/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Cantidad", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "Cantidad", exact: true })
    .fill("0,5");
  await page.getByRole("button", { name: "Confirmar cantidad" }).click();
  await page.getByRole("button", { name: "Añadir Agua", exact: true }).click();
  await page.getByRole("button", { name: "Orden (2)", exact: true }).click();
  await (await noteField(page)).fill("Sin azúcar");
  await closeDetails(page);
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.getByRole("button", { name: "Orden (2)", exact: true }).click();
  await expect(await noteField(page)).toHaveValue("Sin azúcar");
  await closeDetails(page);
  await page
    .getByRole("button", { name: "Continuar al cobro", exact: true })
    .click();
  await expect(
    page.getByRole("status", { name: "Cobro preparado" }),
  ).toContainText("Mostrador 42");
  expect(requests).toHaveLength(1);
  expect(requests[0].body.items[0]).toMatchObject({
    quantity: "0.5",
    quantityUnit: "lb",
  });
  await closeDetails(page);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(page.getByText("Editor cerrado")).toBeVisible();
});
test("recovery misma clave/cuerpo incluso remount; cerrado no prepara cobro", async ({
  page,
}) => {
  const requests = await mock(page, "lost");
  await start(page);
  await page.getByRole("button", { name: "Añadir Café", exact: true }).click();
  await closeDetails(page);
  await page
    .getByRole("button", { name: "Continuar al cobro", exact: true })
    .click();
  await expect(
    page.getByText("Aún no sabemos si el pedido se guardó."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salir", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Volver a montar vista" }).click();
  await page.getByRole("button", { name: "Recuperar guardado" }).click();
  await expect(
    page.getByRole("status", { name: "Cobro preparado" }),
  ).toContainText("Mostrador 42");
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
});
test("version conflict revisión explícita conserva nota y snapshots", async ({
  page,
}) => {
  const requests = await mock(page, "version");
  await start(page, "?existing");
  await (await noteField(page)).fill("Mi borrador");
  await closeDetails(page);
  await page
    .getByRole("button", {
      name: /Confirmar orden|Guardar cambios/,
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Nota de otra persona", { exact: true }),
  ).toBeVisible();
  await expect(await noteField(page)).toHaveValue("Mi borrador");
  await closeDetails(page);
  expect(requests).toHaveLength(1);
  await expect(
    page.getByRole("button", {
      name: /Confirmar orden|Guardar cambios/,
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "He revisado la orden actual; conservar mi borrador",
    })
    .click();
  await closeDetails(page);
  await page
    .getByRole("button", {
      name: /Confirmar orden|Guardar cambios/,
      exact: true,
    })
    .click();
  await expect.poll(() => requests.length).toBe(2);
  expect((requests[1].body as PosUpdateV2).version).toBe(2);
  expect(requests[1].body.items[0].lineId).toBe("old");
});
test("catalog conflict requiere revisión antes de actualizar líneas nuevas", async ({
  page,
}) => {
  const requests = await mock(page, "catalog");
  await start(page);
  await page.getByRole("button", { name: "Añadir Café", exact: true }).click();
  await closeDetails(page);
  await page
    .getByRole("button", { name: "Continuar al cobro", exact: true })
    .click();
  await expect(page.getByText(/Café: 7 por unit/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar al cobro", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "He revisado los productos; actualizar las líneas nuevas",
    })
    .click();
  await closeDetails(page);
  await page
    .getByRole("button", { name: "Continuar al cobro", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].body.items[0].catalogRevision).toBe("9");
});
test("identidad cambia y respuesta tardía no produce callbacks", async ({
  page,
}) => {
  await mock(page, "late");
  await start(page);
  await page.getByRole("button", { name: "Añadir Café", exact: true }).click();
  await closeDetails(page);
  await page
    .getByRole("button", { name: "Continuar al cobro", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cambiar identidad", exact: true })
    .click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("status", { name: "Guardado" })).toBeEmpty();
  await expect(
    page.getByRole("status", { name: "Cobro preparado" }),
  ).toBeEmpty();
});
test("canónico recuperado cerrado se informa sin preparar", async ({
  page,
}) => {
  await mock(page, "closed");
  await start(page);
  await page.getByRole("button", { name: "Añadir Café", exact: true }).click();
  await closeDetails(page);
  await page
    .getByRole("button", { name: "Continuar al cobro", exact: true })
    .click();
  await expect(page.getByRole("status", { name: "Guardado" })).toContainText(
    "closed",
  );
  await expect(
    page.getByRole("status", { name: "Cobro preparado" }),
  ).toBeEmpty();
});

test("local requiere descarte explícito; buscar y frecuentes no añaden llamadas; snapshot anterior separado", async ({
  page,
}) => {
  const requests = await mock(page);
  await start(page, "?existing");
  await page.getByRole("button", { name: "Añadir Café", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Café anterior, línea 1" }),
  ).toContainText("$2,00 / unidad");
  await expect(
    page.getByRole("group", { name: "Café, línea 4" }),
  ).toContainText("$3,00 / unidad");
  await page.getByRole("searchbox", { name: "Buscar productos" }).fill("Agua");
  await expect(
    page.getByRole("button", { name: "Añadir Agua", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar productos" }).fill("");
  await select(page, "Categoría", "Frecuentes");
  await expect(
    page.getByRole("button", { name: "Añadir Agua", exact: true }),
  ).toHaveCount(0);
  expect(requests).toHaveLength(0);
  await select(page, "Local", "Local Sur");
  await page
    .getByRole("button", { name: "Seguir trabajando", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Café, línea 4" }),
  ).toBeVisible();
  await select(page, "Local", "Local Sur");
  await page
    .getByRole("button", {
      name: "Retirar líneas y cambiar local",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("El pedido está vacío. Añade un producto para empezar."),
  ).toBeVisible();
});

test("inspección agrupada 390/1280 y salida con descarte explícito", async ({
  page,
}) => {
  await mock(page);
  await start(page, "?existing");
  await (
    await noteField(page)
  ).fill(
    "Nota larga con detalles del pedido para preparar y entregar con cuidado.",
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 950 });

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 950 });
  await closeDetails(page);
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await page
    .getByRole("button", { name: "Seguir trabajando", exact: true })
    .click();
  await expect(await noteField(page)).toHaveValue(/Nota larga/);
});
test("COP distribuye el total global en filas y no conserva importe para cantidad parcial", async ({
  page,
}) => {
  await mock(page, "cop");
  await start(page, "?cop");
  await page.getByRole("button", { name: "Añadir Café", exact: true }).click();
  await page.getByRole("button", { name: "Añadir Café", exact: true }).click();
  const first = page.getByRole("group", { name: "Café, línea 1" });
  const second = page.getByRole("group", { name: "Café, línea 2" });
  await expect(first).toContainText("COP 1");
  await expect(second).toContainText("COP 0");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    if (width === 390)
      await page
        .getByRole("button", { name: "Orden (2)", exact: true })
        .click();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Editar cantidad de Café, línea 1" })
    .click();
  await page.getByRole("textbox", { name: "Cantidad", exact: true }).fill("1.");
  await expect(first).toContainText("Revisa la cantidad");
  await expect(
    page.getByRole("button", { name: "Confirmar cantidad" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(first).toContainText("COP 1");
});
