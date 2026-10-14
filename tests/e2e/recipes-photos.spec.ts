import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  openPhotoRecipe,
  photoDraft,
  recipeImage,
  recipePhotoFixture,
  sharp,
} from "./support/recipes-photos-fixture";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/modules-ui-harness.tsx",
    "recipes",
  );
});
test.afterAll(async () => harness?.close());

for (const width of [390, 1280]) {
  test(`foto produce borrador editable y guardado explícito (${width})`, async ({
    page,
  }, testInfo) => {
    const writes = await recipePhotoFixture(page);
    let uploads = 0;
    await page.route(
      "**/api/modules/recipes/pizza/draft-photo",
      async (route) => {
        uploads++;
        const contentType = route.request().headers()["content-type"];
        expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
        const multipart = new Response(
          new Uint8Array(route.request().postDataBuffer()!),
          { headers: { "content-type": contentType } },
        );
        const parts = (await multipart.formData()).getAll("photos") as File[];
        expect(parts).toHaveLength(3);
        for (const part of parts) {
          expect(part.type).toBe("image/jpeg");
          expect(part.name).toBe("receta.jpg");
          const image = await sharp(
            Buffer.from(await part.arrayBuffer()),
          ).metadata();
          expect(image.width).toBe(2000);
          expect(image.height).toBe(1200);
        }
        await route.fulfill({ json: { draft: photoDraft } });
      },
    );
    const dialog = await openPhotoRecipe(page, harness.url, width);
    const image = await recipeImage();
    await dialog
      .getByLabel("Fotos de la receta", { exact: true })
      .setInputFiles([image, image]);
    await expect(
      dialog.getByLabel("Cámara para receta", { exact: true }),
    ).toHaveAttribute("capture", "environment");
    await dialog
      .getByLabel("Cámara para receta", { exact: true })
      .setInputFiles(image);
    await expect(
      dialog.getByRole("button", { name: /Quitar foto/ }),
    ).toHaveCount(3);
    await expect(
      dialog.getByRole("button", { name: "Analizar", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath(`recipes-photos-selection-${width}.png`),
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
    await expect(
      dialog.getByText("Revisa los ingredientes", { exact: true }),
    ).toBeVisible();
    expect(uploads).toBe(1);
    expect(writes).toEqual([]);
    await expect(
      dialog.getByText(/Se dividieron las cantidades de la tanda entre 10/),
    ).toBeVisible();
    const quantities = dialog.getByRole("textbox", {
      name: "Cantidad por unidad del producto",
      exact: true,
    });
    await expect(quantities.nth(0)).toHaveValue("7,5");
    await expect(quantities.nth(1)).toHaveValue("");
    const save = dialog.getByRole("button", {
      name: "Guardar receta",
      exact: true,
    });
    await expect(save).toBeDisabled();
    await quantities.nth(0).fill("0,1");
    await quantities.nth(1).fill("2");
    await expect(save).toBeDisabled();
    await dialog
      .getByText(
        "He revisado estos fragmentos y añadido los ingredientes que corresponden.",
        { exact: true },
      )
      .click();
    await expect(
      dialog.getByRole("checkbox", { name: /He revisado estos fragmentos/ }),
    ).toBeChecked();
    await expect(save).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath(`recipes-photos-review-${width}.png`),
      fullPage: true,
    });
    await save.click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([
      {
        lines: [
          { itemId: "flour", quantity: "0.1", unit: "g" },
          { newItem: { name: "Sal" }, quantity: "2", unit: "g" },
        ],
      },
    ]);
  });
}

test("errores del contrato conservan fotos, permiten reelección y reintento", async ({
  page,
}) => {
  const writes = await recipePhotoFixture(page);
  let status = 404;
  let calls = 0;
  await page.route("**/api/modules/recipes/pizza/draft-photo", (route) => {
    calls++;
    return route.fulfill(
      status === 200
        ? { json: { draft: photoDraft } }
        : {
            status,
            json: {
              error: `Error observable ${status}`,
              code: "photo_failure",
            },
          },
    );
  });
  const dialog = await openPhotoRecipe(page, harness.url);
  const image = await recipeImage();
  await dialog
    .getByLabel("Fotos de la receta", { exact: true })
    .setInputFiles(image);
  for (status of [404, 403, 413, 415, 422, 503]) {
    await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
    await expect(
      dialog.getByText(`Error observable ${status}`, { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Quitar foto 1", exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole("button", { name: "Cargar a mano", exact: true }),
    ).toBeEnabled();
  }
  const picker = page.waitForEvent("filechooser");
  await dialog
    .getByRole("button", { name: "Cambiar fotos", exact: true })
    .click();
  await (await picker).setFiles(image);
  await expect(
    dialog.getByText("Error observable 503", { exact: true }),
  ).toHaveCount(0);
  status = 200;
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByText("Revisa los ingredientes", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(7);
  expect(writes).toEqual([]);
});

test("espera bloquea cierre y doble envío; dictado y manual siguen disponibles", async ({
  page,
}) => {
  await recipePhotoFixture(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route(
    "**/api/modules/recipes/pizza/draft-photo",
    async (route) => {
      calls++;
      await pending;
      await route.fulfill({
        status: 503,
        json: { error: "Intenta otra vez o carga a mano." },
      });
    },
  );
  const dialog = await openPhotoRecipe(page, harness.url);
  await dialog.getByRole("button", { name: "Dictado", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "Describe tu receta", exact: true })
    .fill("Harina para 10 pizzas");
  await dialog.getByRole("button", { name: "Foto", exact: true }).click();
  await dialog
    .getByLabel("Fotos de la receta", { exact: true })
    .setInputFiles(await recipeImage());
  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect.poll(() => calls).toBe(1);
  await expect(dialog.getByRole("status")).toContainText("hasta 45 segundos");
  await expect(
    dialog.getByRole("button", { name: "Descartar", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Cerrar", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.locator(".staff-modal-scrim").click({ force: true });
  await expect(dialog).toBeVisible();
  release();
  await expect(
    dialog.getByText("Intenta otra vez o carga a mano.", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await dialog.getByRole("button", { name: "Dictado", exact: true }).click();
  await expect(
    dialog.getByRole("textbox", { name: "Describe tu receta", exact: true }),
  ).toHaveValue("Harina para 10 pizzas");
  await dialog
    .getByRole("button", { name: "Cargar a mano", exact: true })
    .click();
  await expect(
    dialog.getByText("Revisa los ingredientes", { exact: true }),
  ).toBeVisible();
});

test("límites se comprueban antes del envío y original no decodificable usa fallback", async ({
  page,
}) => {
  await recipePhotoFixture(page);
  let calls = 0;
  await page.route(
    "**/api/modules/recipes/pizza/draft-photo",
    async (route) => {
      calls++;
      const multipart = new Response(
        new Uint8Array(route.request().postDataBuffer()!),
        {
          headers: {
            "content-type": route.request().headers()["content-type"],
          },
        },
      );
      const [part] = (await multipart.formData()).getAll("photos") as File[];
      expect(part.name).toBe("receta.heic");
      expect(Buffer.from(await part.arrayBuffer()).toString()).toBe(
        "original-no-decodificable",
      );
      await route.fulfill({ json: { draft: photoDraft } });
    },
  );
  const dialog = await openPhotoRecipe(page, harness.url);
  const input = dialog.getByLabel("Fotos de la receta", { exact: true });
  const image = await recipeImage();
  await input.setInputFiles([image, image, image, image]);
  await expect(
    dialog.getByText("Elige entre 1 y 3 fotos.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Analizar", exact: true }),
  ).toBeDisabled();
  await input.setInputFiles({
    name: "grande.heic",
    mimeType: "image/heic",
    buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
  });
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByText("Las fotos son muy pesadas. Elige fotos más pequeñas.", {
      exact: true,
    }),
  ).toBeVisible();
  const large = {
    name: "total.heic",
    mimeType: "image/heic",
    buffer: Buffer.alloc(Math.ceil(2.3 * 1024 * 1024)),
  };
  await input.setInputFiles([large, large]);
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByText("Las fotos son muy pesadas. Elige fotos más pequeñas.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Quitar foto/ })).toHaveCount(
    2,
  );
  await dialog
    .getByRole("button", { name: "Quitar foto 2", exact: true })
    .click();
  await expect(dialog.getByRole("button", { name: /Quitar foto/ })).toHaveCount(
    1,
  );
  expect(calls).toBe(0);
  await input.setInputFiles({
    name: "receta.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("original-no-decodificable"),
  });
  await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
  await expect(
    dialog.getByText("Revisa los ingredientes", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
