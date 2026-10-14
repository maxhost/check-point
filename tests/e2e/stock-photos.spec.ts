import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  openStockPhotos,
  setupStockPhotos,
  stockImage,
  stockPhotoDraft,
  uploadedPhotos,
} from "./support/stock-photos-fixture";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/modules-ui-harness.tsx",
    "stock",
  );
});
test.afterAll(async () => {
  if (harness) await harness.close();
});

for (const width of [390, 1280]) {
  test(`Foto prepara JPEG, espera protegida y borrador editable (${width})`, async ({
    page,
  }, info) => {
    await setupStockPhotos(page);
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    let upload: Awaited<ReturnType<typeof uploadedPhotos>> | undefined;
    const writes: unknown[] = [];
    await page.route(
      "**/api/modules/stock/entries/draft-photo",
      async (route) => {
        calls++;
        upload = await uploadedPhotos(route.request());
        await waiting;
        await route.fulfill({ json: { draft: stockPhotoDraft } });
      },
    );
    await page.route("**/api/modules/stock/entries", (route) => {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    });
    const dialog = await openStockPhotos(page, harness.url);
    await expect(
      dialog.getByRole("button", { name: "Analizar", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByLabel("Fotos de stock desde galería")
      .setInputFiles(await stockImage(page));
    await expect(
      dialog.getByRole("button", { name: "Analizar", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: info.outputPath(`stock-photo-${width}.png`),
      fullPage: true,
    });
    await dialog.locator("form").evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(dialog.getByRole("status")).toContainText("45 segundos");
    await expect.poll(() => calls).toBe(1);
    await expect(
      dialog.getByRole("button", { name: "Descartar", exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Cerrar", exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByLabel("Fotos de stock desde galería"),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(writes).toEqual([]);
    expect(upload!.type).toContain("multipart/form-data; boundary=");
    expect(upload!.keys).toEqual(["photos"]);
    expect(upload!.photos[0].type).toBe("image/jpeg");
    const encoded = Buffer.from(await upload!.photos[0].arrayBuffer()).toString(
      "base64",
    );
    const dimensions = await page.evaluate(async (encoded) => {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${encoded}`;
      await image.decode();
      return [image.width, image.height];
    }, encoded);
    expect(dimensions).toEqual([2000, 1000]);
    release();
    await expect(
      dialog.getByRole("heading", { name: "Revisa los ítems", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", {
        name: "Precio total (opcional)",
        exact: true,
      }),
    ).toHaveValue("");
    await expect(
      dialog.getByRole("button", { name: "Guardar compra", exact: true }),
    ).toBeDisabled();
    await dialog
      .getByRole("textbox", { name: "Cantidad", exact: true })
      .fill("2,5");
    await dialog
      .getByText(
        "He revisado estos fragmentos y añadido los ítems que quiero registrar.",
        { exact: true },
      )
      .click();
    await expect(dialog.getByRole("checkbox")).toBeChecked();
    await dialog
      .getByRole("button", { name: "Volver a las fotos", exact: true })
      .click();
    await expect(dialog).toContainText("compra.png");
    await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: "Revisa los ítems", exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("textbox", { name: "Cantidad", exact: true })
      .fill("2,5");
    await dialog
      .getByText(
        "He revisado estos fragmentos y añadido los ítems que quiero registrar.",
        { exact: true },
      )
      .click();
    await expect(dialog.getByRole("checkbox")).toBeChecked();
    await dialog.getByRole("button", { name: "Insumo", exact: false }).click();
    await expect(
      page.getByRole("option", { name: "Archivado", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await dialog
      .getByRole("button", { name: "Guardar compra", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([
      {
        lines: [
          { itemId: "flour", quantity: "2.5", unit: "kg", totalCost: null },
        ],
      },
    ]);
  });
}

test("Errores HTTP conservan selección para reintentar y cargar a mano", async ({
  page,
}) => {
  await setupStockPhotos(page);
  const statuses = [422, 413, 415, 503, 403];
  let calls = 0;
  await page.route("**/api/modules/stock/entries/draft-photo", (route) => {
    const status = statuses[calls++] ?? 200;
    return route.fulfill(
      status === 200
        ? { json: { draft: stockPhotoDraft } }
        : {
            status,
            json: {
              error: `Error de foto ${status}. Intenta otra vez.`,
              code: "fixture_error",
            },
          },
    );
  });
  const dialog = await openStockPhotos(page, harness.url);
  const original = {
    name: "compra.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("browser-cannot-decode"),
  };
  await dialog
    .getByLabel("Fotos de stock desde galería")
    .setInputFiles(original);
  for (const status of statuses) {
    await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
    await expect(dialog).toContainText(
      `Error de foto ${status}. Intenta otra vez.`,
    );
    await expect(dialog).toContainText("compra.heic");
    await expect(
      dialog.getByRole("button", { name: "Analizar", exact: true }),
    ).toBeEnabled();
  }
  await dialog
    .getByRole("button", { name: "Cargar a mano", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Guardar compra", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Audio", exact: true }).click();
  await expect(
    dialog.getByRole("textbox", { name: "Describe tu compra", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Foto", exact: true }).click();
  await expect(dialog).toContainText("compra.heic");
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Revisa los ítems", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(6);
});

test("Galería reemplaza, cámara añade, límites no envían y ajuste no ofrece foto", async ({
  page,
}) => {
  await setupStockPhotos(page);
  let calls = 0;
  let upload: Awaited<ReturnType<typeof uploadedPhotos>> | undefined;
  await page.route(
    "**/api/modules/stock/entries/draft-photo",
    async (route) => {
      calls++;
      upload = await uploadedPhotos(route.request());
      await route.fulfill({
        status: 415,
        json: { error: "No pudimos leer estas fotos." },
      });
    },
  );
  const dialog = await openStockPhotos(page, harness.url);
  const gallery = dialog.getByLabel("Fotos de stock desde galería");
  const camera = dialog.getByLabel("Foto de stock desde cámara");
  await expect(camera).toHaveAttribute("capture", "environment");
  const opaque = (name: string, size = 10) => ({
    name,
    mimeType: "image/heic",
    buffer: Buffer.alloc(size, 1),
  });
  await gallery.setInputFiles([
    opaque("a.heic"),
    opaque("b.heic"),
    opaque("c.heic"),
    opaque("d.heic"),
  ]);
  await expect(dialog).toContainText("Elige entre 1 y 3 fotos");
  await expect(
    dialog.getByRole("button", { name: "Analizar", exact: true }),
  ).toBeDisabled();
  await gallery.setInputFiles(opaque("a.heic", 4 * 1024 * 1024 + 1));
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(dialog).toContainText("Las fotos son muy pesadas");
  await gallery.setInputFiles([
    opaque("a.heic", 2.3 * 1024 * 1024),
    opaque("b.heic", 2.3 * 1024 * 1024),
  ]);
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(dialog).toContainText("Las fotos son muy pesadas");
  expect(calls).toBe(0);
  await gallery.setInputFiles(opaque("a.heic"));
  await camera.setInputFiles(opaque("b.heic"));
  await camera.setInputFiles(opaque("c.heic"));
  await expect(
    dialog.getByRole("button", { name: "Tomar foto", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Quitar foto 2", exact: true })
    .click();
  await expect(dialog).not.toContainText("b.heic");
  await gallery.setInputFiles(opaque("a.heic"));
  await expect(dialog).not.toContainText("c.heic");
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(dialog).toContainText("No pudimos leer estas fotos.");
  expect(calls).toBe(1);
  expect(upload!.photos).toHaveLength(1);
  expect(upload!.photos[0].name).toBe("a.heic");
  expect(Buffer.from(await upload!.photos[0].arrayBuffer())).toEqual(
    opaque("a.heic").buffer,
  );
  await dialog
    .getByRole("button", { name: "Quitar foto 1", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Analizar", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Descartar", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar stock", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ajustar stock", exact: true })
    .click();
  const adjustment = page.getByRole("dialog", {
    name: "Ajustar stock",
    exact: true,
  });
  await expect(
    adjustment.getByRole("button", { name: "Foto", exact: true }),
  ).toHaveCount(0);
  await expect(
    adjustment.getByRole("textbox", { name: "Cantidad contada", exact: true }),
  ).toBeVisible();
});
