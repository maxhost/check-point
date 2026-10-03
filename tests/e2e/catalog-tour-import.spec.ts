import { expect } from "@playwright/test";
import { test, title, help } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";

test.use({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
  hasTouch: true,
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
  "base64",
);

function photo(name: string) {
  return { name, mimeType: "image/png", buffer: png };
}

test("PDF autoanaliza; salir de la guía no cancela y resultado explica sin precio", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Importar un PDF");
  await page
    .getByRole("button", { name: "Importar con IA", exact: true })
    .click();
  await expect(title(page)).toHaveText("Elige los archivos");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(photo("antes-del-pdf.png"));
  await expect(
    page.getByRole("list", { name: "Archivos seleccionados" }),
  ).toContainText("antes-del-pdf.png");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "menu.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf fixture"),
    });
  await expect(title(page)).toHaveText("Estamos procesando tu menú");
  await expect(page.locator(".catalog-ai-file-pdf")).toContainText("menu.pdf");
  await expect(page.locator(".catalog-ai-file-pdf")).not.toContainText(
    "antes-del-pdf.png",
  );
  await expect(
    page.getByRole("button", { name: "Quitar menu.pdf" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancelar importación", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salir de la guía", exact: true })
    .click();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancelar importación", exact: true }),
  ).toBeVisible();
  expect(api.cancellations).toBe(0);
  api.importStatus = "accepted";
  await expect(
    page.getByText("Catálogo importado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("sin precio", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver mi catálogo" }).click();
  expect(api.progress).toEqual([]);
});

test("tres fotos muestran miniaturas y quitar una cambia el análisis", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await page.getByRole("button", { name: "Importar con IA" }).click();
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles([
    photo("primera.png"),
    photo("segunda.png"),
    photo("tercera.png"),
  ]);

  const cards = page.getByRole("list", { name: "Archivos seleccionados" });
  await expect(cards.locator("li")).toHaveCount(3);
  await expect(cards.getByRole("img", { name: /Vista previa de/ })).toHaveCount(
    3,
  );
  await expect
    .poll(() =>
      cards
        .getByRole("img", { name: "Vista previa de primera.png" })
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".catalog-dropzone strong")).toHaveText(
    "Sube tu menú o lista de precios",
  );
  const secondUrl = await cards
    .getByRole("img", { name: "Vista previa de segunda.png" })
    .getAttribute("src");
  await page.evaluate(() => {
    const original = URL.revokeObjectURL.bind(URL);
    (window as Window & { revokedUrls?: string[] }).revokedUrls = [];
    (window as Window & { chooserClicks?: number }).chooserClicks = 0;
    document
      .querySelector('input[type="file"]')
      ?.addEventListener("click", () => {
        const view = window as Window & { chooserClicks?: number };
        view.chooserClicks = (view.chooserClicks ?? 0) + 1;
      });
    URL.revokeObjectURL = (url) => {
      (window as Window & { revokedUrls?: string[] }).revokedUrls?.push(url);
      original(url);
    };
  });
  await cards.getByRole("button", { name: "Quitar segunda.png" }).click();
  await expect(cards.locator("li")).toHaveCount(2);
  await expect(cards.locator(".catalog-ai-file-name")).toHaveText([
    "primera.png",
    "tercera.png",
  ]);
  expect(
    await page.evaluate(
      () => (window as Window & { chooserClicks?: number }).chooserClicks,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      (url) =>
        (window as Window & { revokedUrls?: string[] }).revokedUrls?.includes(
          url,
        ),
      secondUrl,
    ),
  ).toBe(true);
  const removeBox = await cards
    .getByRole("button", { name: "Quitar primera.png" })
    .boundingBox();
  expect(removeBox?.width).toBeGreaterThanOrEqual(44);
  expect(removeBox?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const remainingUrls = await cards
    .getByRole("img", { name: /Vista previa de/ })
    .evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).src),
    );
  expect(api.writes).toEqual([]);
  await page.getByRole("button", { name: "Analizar catálogo" }).click();
  await expect.poll(() => api.writes.length).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        (urls) =>
          urls.every((url) =>
            (
              window as Window & { revokedUrls?: string[] }
            ).revokedUrls?.includes(url),
          ),
        remainingUrls,
      ),
    )
    .toBe(true);
  expect(api.writes[0].body.files).toEqual([
    { name: "primera.png", contentType: "image/png", byteSize: png.length },
    { name: "tercera.png", contentType: "image/png", byteSize: png.length },
  ]);
  await expect.poll(() => api.uploads.length).toBe(2);
  expect(api.uploads.map((upload) => upload.contentType)).toEqual([
    "image/png",
    "image/png",
  ]);
  expect(api.uploads.map((upload) => upload.bytes)).toEqual([png, png]);
});

test("cámara, buscador y soltar agregan fotos; quitar la última desactiva analizar", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await page.getByRole("button", { name: "Importar con IA" }).click();
  const cards = page.getByRole("list", { name: "Archivos seleccionados" });
  await page
    .locator('input[capture="environment"]')
    .setInputFiles(photo("camara.png"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(photo("galeria.png"));
  await page.locator(".catalog-dropzone").evaluate((dropzone) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([1, 2, 3])], "soltada.png", {
        type: "image/png",
      }),
    );
    dropzone.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
    );
  });
  await expect(cards.locator(".catalog-ai-file-name")).toHaveText([
    "camara.png",
    "galeria.png",
    "soltada.png",
  ]);
  await page.locator('input[type="file"]').first().setInputFiles([]);
  await expect(cards.locator("li")).toHaveCount(3);
  await cards.getByRole("button", { name: "Quitar camara.png" }).focus();
  await page.keyboard.press("Enter");
  for (const name of ["galeria.png", "soltada.png"])
    await cards.getByRole("button", { name: `Quitar ${name}` }).click();
  await expect(cards).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Analizar catálogo" }),
  ).toBeDisabled();
  await page
    .locator('input[capture="environment"]')
    .setInputFiles(photo("camara.png"));
  await expect(cards.locator("li")).toHaveCount(1);
  await cards.getByRole("button", { name: "Quitar camara.png" }).click();
  await expect(cards).toHaveCount(0);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      photo("mezcla.png"),
      {
        name: "mezcla.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("pdf fixture"),
      },
    ]);
  await expect(
    page
      .getByRole("alert")
      .getByText("Elige un PDF o solamente imágenes, sin mezclarlos."),
  ).toBeVisible();
  expect(api.writes).toEqual([]);
});

test("PDF importado antes de reabrir muestra tarjeta sin nombre", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.importing = true;
  api.importSourceKind = "pdf";
  await page.goto(catalogHarness);
  await page.getByRole("button", { name: "Importar con IA" }).click();
  await expect(page.locator(".catalog-ai-file-pdf")).toContainText("PDF");
  await expect(
    page.locator(".catalog-ai-file-pdf .catalog-ai-file-name"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancelar importación" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar importación" }).click();
  await expect.poll(() => api.cancellations).toBe(1);
});

test("PDF retomado muestra el nombre si el API lo entrega", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.importing = true;
  api.importSourceKind = "pdf";
  api.importSourceFileName = "menu-recuperado.pdf";
  await page.goto(catalogHarness);
  await page.getByRole("button", { name: "Importar con IA" }).click();
  await expect(page.locator(".catalog-ai-file-pdf")).toContainText(
    "menu-recuperado.pdf",
  );
});

test("fotos esperan Analizar y resultado termina la ayuda", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Importar fotos desde el celular");
  await page
    .getByRole("button", { name: "Importar con IA", exact: true })
    .click();
  await expect(title(page)).toHaveText("Elige los archivos");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "menu.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("image fixture"),
    });
  await expect(title(page)).toHaveText("Analiza las fotos");
  expect(api.writes).toEqual([]);
  api.importStatus = "accepted";
  await page
    .getByRole("button", { name: "Analizar catálogo", exact: true })
    .click();
  await expect(title(page)).toHaveText("Tu catálogo ya está cargado");
  await page.getByRole("button", { name: "Ver mi catálogo" }).click();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  expect(api.progress).toEqual([]);
});

test("import existente y staff: permisos, bloqueo de altas y ningún progreso", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.importing = true;
  await page.goto(`${catalogHarness}?staff&tour=onboarding`);
  await expect(
    page.getByRole("heading", { name: "Productos listos para vender" }),
  ).toBeVisible();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "¿Qué quieres hacer?" });
  await expect(
    dialog.getByRole("button", { name: /Crear un producto/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Eliminar un producto/ }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: /Ver importación en curso/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Importar con IA", exact: true })
    .click();
  await expect(title(page)).toHaveText("Estamos procesando tu menú");
  expect(api.progress).toEqual([]);
});
