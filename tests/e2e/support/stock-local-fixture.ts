import type { Page } from "@playwright/test";
import { setupStockPhotos } from "./stock-photos-fixture";

export const localLocations = [
  { id: "first", name: "Centro", status: "active" },
  { id: "second", name: "Norte", status: "active" },
  { id: "archived", name: "Sur", status: "archived" },
];
export async function stockLocalFixture(page: Page, single = false) {
  await setupStockPhotos(page);
  const reads: string[] = [];
  await page.route("**/api/modules/stock/locations", (route) =>
    route.fulfill({
      json: {
        locations: single ? localLocations.slice(0, 1) : localLocations,
        defaultLocationId: "first",
      },
    }),
  );
  await page.route(/\/api\/modules\/stock\/items(?:\?|$)/, (route) => {
    const local = new URL(route.request().url()).searchParams.get("locationId");
    reads.push(local ?? "");
    return route.fulfill({
      json: {
        items: [
          {
            id: "flour",
            name: "Harina",
            unit: "g",
            status: "active",
            onHand: local === "second" ? "-750.000" : "1000.000",
            lastUnitCost: local === "second" ? "0.020000" : "0.010000",
          },
        ],
      },
    });
  });
  await page.route("**/api/modules/stock/movements?*", (route) =>
    route.fulfill({
      json: {
        movements: [
          {
            id: "movement",
            itemId: "flour",
            itemName: "Harina",
            unit: "g",
            kind: "consumption",
            quantity: "-750.000",
            countedQuantity: null,
            totalCost: null,
            sourceOrderId: "sale",
            createdAt: "2026-10-14T12:00:00Z",
            occurredAt: "2026-10-14T12:00:00Z",
          },
        ],
        pending: { count: 1, failed: 1 },
      },
    }),
  );
  return { reads };
}
export async function chooseLocal(page: Page, name: string) {
  await page.getByRole("button", { name: "Local", exact: false }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
