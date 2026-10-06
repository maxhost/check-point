import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { merchantURL } from "./support/ports";

test("alta en tres pasos comparte la sesión de Places y crea el negocio una vez", async ({
  page,
}) => {
  const tokens: string[] = [];
  const signupBodies: unknown[] = [];
  await page.route("**/api/onboarding/state", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.route("**/api/onboarding/prefill", (route) =>
    route.fulfill({
      json: { categories: [{ gcid: "gcid:cafe", displayName: "Cafetería" }] },
    }),
  );
  await page.route("**/api/places/autocomplete", async (route) => {
    tokens.push(
      (route.request().postDataJSON() as { sessionToken: string }).sessionToken,
    );
    await route.fulfill({
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
    });
  });
  await page.route("**/api/places/details", async (route) => {
    tokens.push(
      (route.request().postDataJSON() as { sessionToken: string }).sessionToken,
    );
    await route.fulfill({
      json: {
        place: {
          placeId: "place-1",
          kind: "business",
          addressLabel: "Av. Remigio Crespo, Cuenca",
          suggestedCategoryGcid: "gcid:cafe",
        },
        selectionToken: "signed-place",
      },
    });
  });
  await page.route("**/api/onboarding/signup", async (route) => {
    signupBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      json: {
        created: true,
        verificationSent: true,
        business: {
          id: "business-1",
          name: "Café Plátano",
          slug: "cafe-platano",
        },
      },
    });
  });

  await page.goto(`${merchantURL}/es/business/onboarding`);
  await expect(
    page.getByRole("heading", { name: "Encuentra tu negocio" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Busca tu negocio o dirección" })
    .fill("cafe platano");
  await page.getByRole("option", { name: /Café Plátano.*Cuenca/ }).click();
  await expect(page.getByText("Av. Remigio Crespo, Cuenca")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "¿Cuál es tu email?" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Tu email" })
    .fill("owner@example.com");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu negocio Café Plátano está listo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir a mi panel" }),
  ).toHaveAttribute("href", "/backoffice");
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).toBe(tokens[1]);
  expect(tokens[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(signupBodies).toEqual([
    {
      email: "owner@example.com",
      business: {
        name: "Café Plátano",
        categoryGcid: "gcid:cafe",
        selectionToken: "signed-place",
      },
    },
  ]);
});

test("local nuevo envía address.selectionToken y conserva el formulario ante error", async ({
  page,
}) => {
  const harness = await startCatalogHarness(
    "tests/e2e/support/loyalty-regression-entry.tsx",
  );
  try {
    const bodies: unknown[] = [];
    await page.route("**/api/places/autocomplete", (route) =>
      route.fulfill({
        json: {
          suggestions: [
            {
              placeId: "place-2",
              kind: "address",
              mainText: "Av. Amazonas",
              secondaryText: "Quito, Ecuador",
            },
          ],
        },
      }),
    );
    await page.route("**/api/places/details", (route) =>
      route.fulfill({
        json: {
          place: {
            placeId: "place-2",
            kind: "address",
            addressLabel: "Av. Amazonas, Quito, Ecuador",
            suggestedCategoryGcid: null,
          },
          selectionToken: "signed-location",
        },
      }),
    );
    await page.route("**/api/locations", async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({
        status: 422,
        json: {
          code: "address_country_mismatch",
          error: "Esa dirección está en otro país que tu negocio.",
        },
      });
    });
    await page.goto(`${harness.url}?surface=locations`);
    await page.getByRole("button", { name: /Añadir local/ }).click();
    await page
      .getByRole("textbox", { name: "Nombre del local" })
      .fill("Centro");
    await page
      .getByRole("combobox", { name: "Busca la dirección" })
      .fill("Av. Amazonas");
    await page.getByRole("option", { name: /Av. Amazonas.*Quito/ }).click();
    await page.getByRole("button", { name: "Crear local" }).click();
    await expect(
      page.getByText("Esa dirección está en otro país que tu negocio."),
    ).toBeVisible();
    expect(bodies).toEqual([
      {
        name: "Centro",
        address: {
          label: "Av. Amazonas, Quito, Ecuador",
          selectionToken: "signed-location",
        },
      },
    ]);
  } finally {
    await harness.close();
  }
});

// Spec 0160: al elegir, React Aria escribe el texto de la opcion en el campo. Con `details` lento
// (mas que el debounce de 300 ms) eso no puede disparar otro `autocomplete`.
test("elegir una sugerencia no dispara otra busqueda", async ({ page }) => {
  const autocompletes: string[] = [];
  await page.route("**/api/onboarding/state", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.route("**/api/onboarding/prefill", (route) =>
    route.fulfill({
      json: { categories: [{ gcid: "gcid:cafe", displayName: "Cafetería" }] },
    }),
  );
  await page.route("**/api/places/autocomplete", async (route) => {
    autocompletes.push(
      (route.request().postDataJSON() as { input: string }).input,
    );
    await route.fulfill({
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
    });
  });
  await page.route("**/api/places/details", async (route) => {
    await new Promise((done) => setTimeout(done, 1000));
    await route.fulfill({
      json: {
        place: {
          placeId: "place-1",
          kind: "business",
          addressLabel: "Av. Remigio Crespo, Cuenca",
          suggestedCategoryGcid: "gcid:cafe",
        },
        selectionToken: "signed-place",
      },
    });
  });
  await page.goto(`${merchantURL}/es/business/onboarding`);
  await page
    .getByRole("combobox", { name: "Busca tu negocio o dirección" })
    .fill("cafe platano");
  await page.getByRole("option", { name: /Café Plátano.*Cuenca/ }).click();
  await expect(page.getByText("Av. Remigio Crespo, Cuenca")).toBeVisible();
  expect(autocompletes).toEqual(["cafe platano"]);
});
