import { expect, test, type Locator } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  choosePlace,
  onboardingPlacesFixture,
} from "./support/onboarding-places-fixture";

// Spec 0158: el CSS propio del merchant vive en `@layer legacy`, debajo de las utilidades,
// asi que los controles del kit se ven como el kit los declara (y no como globals.css u
// onboarding.css los pisaban).
const kitInput = {
  "padding-left": "14px",
  "padding-top": "10px",
  "border-top-left-radius": "14px",
  "border-top-color": "rgb(130, 153, 141)",
};
const primary = "rgb(23, 101, 72)";

async function expectKitInput(
  input: Locator,
  border = kitInput["border-top-color"],
) {
  for (const [property, value] of Object.entries({
    ...kitInput,
    "border-top-color": border,
  }))
    await expect(input).toHaveCSS(property, value);
}

test("backoffice: globals.css no pisa a los controles del kit", async ({
  page,
}) => {
  const harness = await startCatalogHarness(
    "tests/e2e/support/ui-layers-entry.tsx",
  );
  try {
    await page.goto(harness.url);
    await expectKitInput(page.getByRole("textbox", { name: "Campo valido" }));
    await expectKitInput(
      page.getByRole("textbox", { name: "Campo invalido" }),
      "rgb(142, 42, 42)",
    );
    const secondary = page.getByRole("button", { name: "Secundario" });
    await expect(secondary).toHaveCSS("border-top-width", "1px");
    await expect(secondary).toHaveCSS("font-weight", "700");
    await expect(page.getByRole("button", { name: "Primario" })).toHaveCSS(
      "background-color",
      primary,
    );
  } finally {
    await harness.close();
  }
});

test("onboarding real: el orden de capas sobrevive al pipeline de Next", async ({
  page,
}) => {
  await onboardingPlacesFixture(page);
  await choosePlace(page);
  await expectKitInput(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  );
  await expect(page.getByRole("button", { name: "Continuar" })).toHaveCSS(
    "background-color",
    primary,
  );
});
