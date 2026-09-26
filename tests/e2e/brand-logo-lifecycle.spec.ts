import { expect } from "@playwright/test";
import { test, brandFixture } from "./support/brand-tour-fixture";

test.use({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });

test("Quitar invalida preparación pendiente y la respuesta vieja no restaura logo", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  api.brand.logoPath =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  await page.addInitScript(() => {
    const RealImage = window.Image;
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src",
    )!;
    window.Image = function () {
      const img = new RealImage();
      Object.defineProperty(img, "src", {
        get() {
          return descriptor.get!.call(img);
        },
        set(value) {
          window.addEventListener(
            "brand-release-probe",
            () => {
              img.addEventListener("load", () => {
                document.documentElement.dataset.brandProbeComplete = "true";
              });
              descriptor.set!.call(img, value);
            },
            { once: true },
          );
        },
      });
      return img;
    } as typeof Image;
  });
  await page.goto(`${brandHarness}?staff`);
  await page.locator("#brand-logo-file").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("Preparando imagen…")).toBeVisible();
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  const save = page.getByRole("button", { name: "Guardar marca", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(
    page.getByText("Marca guardada.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("brand-release-probe")),
  );
  await page.waitForFunction(
    () => document.documentElement.dataset.brandProbeComplete === "true",
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await expect(page.locator(".image-cropper")).toHaveCount(0);
  await expect(page.getByAltText("Logo de Café Inicial")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elegir logo" })).toBeEnabled();
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0].logoAction).toBe("remove");
  expect(api.uploads).toBe(0);
});
