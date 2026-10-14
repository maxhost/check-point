import type { Page, Request } from "@playwright/test";
import { businessModules } from "./modules-fixture";

export const stockPhotoDraft = {
  lines: [
    {
      itemId: "flour",
      name: "Harina",
      isNew: false,
      quantity: "1.5",
      unit: "kg",
      totalCost: null,
      sourceText: "Harina 1,5 kg",
    },
  ],
  unparsed: ["Precio ilegible"],
};

export async function setupStockPhotos(page: Page) {
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        membership: { role: "owner" },
        business: {
          enabledModules: ["stock", "recipes"],
          timezone: "America/Guayaquil",
          currencyCode: "USD",
        },
      },
    }),
  );
  await page.route("**/api/modules/stock/locations", (route) =>
    route.fulfill({
      json: {
        locations: [{ id: "local", name: "Local", status: "active" }],
        defaultLocationId: "local",
      },
    }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules: businessModules(true, true) } }),
  );
  await page.route("**/api/modules/stock/movements?*", (route) =>
    route.fulfill({
      json: { movements: [], pending: { count: 0, failed: 0 } },
    }),
  );
  await page.route(/\/api\/modules\/stock\/items(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        items: [
          { id: "flour", name: "Harina", unit: "g", status: "active" },
          { id: "old", name: "Archivado", unit: "g", status: "archived" },
        ],
      },
    }),
  );
}

export async function openStockPhotos(page: Page, url: string) {
  await page.goto(`${url}/backoffice/stock?surface=stock`);
  await page
    .getByRole("button", { name: "Registrar stock", exact: true })
    .click();
  await page.getByRole("button", { name: "Nuevo stock", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo stock", exact: true });
  await dialog.getByRole("button", { name: "Foto", exact: true }).click();
  return dialog;
}

export async function stockImage(page: Page, width = 3000, height = 1500) {
  const encoded = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.fillRect(0, 0, width, height);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { width, height },
  );
  return {
    name: "compra.png",
    mimeType: "image/png",
    buffer: Buffer.from(encoded, "base64"),
  };
}

export async function uploadedPhotos(request: Request) {
  const type = request.headers()["content-type"];
  const form = await new Response(new Uint8Array(request.postDataBuffer()!), {
    headers: { "content-type": type },
  }).formData();
  return {
    type,
    keys: [...form.keys()],
    photos: form.getAll("photos") as File[],
  };
}
