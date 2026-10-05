import { expect, type Page } from "@playwright/test";

import { merchantURL } from "./ports";

export { merchantURL };

/** Rutas del alta con Places (mismas que onboarding-google-places.spec.ts) hasta el paso 1. */
export async function onboardingPlacesFixture(page: Page) {
  await page.route("**/api/onboarding/state", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.route("**/api/onboarding/prefill", (route) =>
    route.fulfill({
      json: { categories: [{ gcid: "gcid:cafe", displayName: "Cafetería" }] },
    }),
  );
  await page.route("**/api/places/autocomplete", (route) =>
    route.fulfill({
      json: {
        suggestions: [
          {
            placeId: "place-1",
            kind: "business",
            mainText: "Café Plátano",
            secondaryText: "Cuenca, Ecuador",
          },
        ],
      },
    }),
  );
  await page.route("**/api/places/details", (route) =>
    route.fulfill({
      json: {
        place: {
          placeId: "place-1",
          kind: "business",
          addressLabel: "Av. Remigio Crespo, Cuenca",
          suggestedCategoryGcid: "gcid:cafe",
        },
        selectionToken: "signed-place",
      },
    }),
  );
  await page.goto(`${merchantURL}/es/business/onboarding`);
  await expect(
    page.getByRole("heading", { name: "Encuentra tu negocio" }),
  ).toBeVisible();
}

export async function choosePlace(page: Page) {
  await page
    .getByRole("searchbox", { name: "Busca tu negocio o dirección" })
    .fill("cafe platano");
  await page.getByRole("button", { name: /Café Plátano.*Cuenca/ }).click();
  await expect(page.getByText("Av. Remigio Crespo, Cuenca")).toBeVisible();
}
