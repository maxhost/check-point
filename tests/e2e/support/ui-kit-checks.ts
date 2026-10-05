import { expect, test, type Locator, type Page } from "@playwright/test";
import { startCatalogHarness } from "./catalog-harness-server";

// Spec 0159: oraculos del kit. Los registran ui-kit.spec.ts (Chromium) y ui-kit.webkit.spec.ts.
// Oraculo 1 (estilos computados) corre en todos lados; oraculo 2 (capturas de Mac) no en la CI.
const content = "rgb(16, 37, 29)";
const muted = "rgb(82, 100, 91)";
const mutedDark = "rgb(182, 200, 190)";
const widths = [390, 1280] as const;
const themes = ["light", "dark"] as const;

async function expectCss(target: Locator, css: Record<string, string>) {
  for (const [property, value] of Object.entries(css))
    await expect(target, property).toHaveCSS(property, value);
}

async function box(target: Locator) {
  const value = await target.boundingBox();
  if (!value) throw new Error("elemento sin caja");
  return value;
}

export function registerKitTests() {
  test.describe.configure({ mode: "default" });
  let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
  test.beforeAll(async () => {
    harness = await startCatalogHarness("tests/e2e/support/ui-kit-entry.tsx");
  });
  test.afterAll(() => harness.close());

  async function open(
    page: Page,
    width: number,
    theme: "light" | "dark" = "light",
  ) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`${harness.url}/?theme=${theme}`);
    await expect(page.getByRole("heading", { name: "Titulo 1" })).toBeVisible();
  }

  for (const width of widths) {
    const wide = width === 1280;

    test(`estilos computados del kit en ${width}`, async ({ page }) => {
      await open(page, width);
      const heading = (name: string) =>
        page.getByRole("heading", { name, exact: true });
      const headings = {
        "Titulo 1": wide ? ["30px", "37.5px"] : ["24px", "30px"],
        "Titulo 2": ["20px", "28px"],
        "Titulo 3": ["18px", "28px"],
      };
      for (const [name, [size, lineHeight]] of Object.entries(headings))
        await expectCss(heading(name), {
          "font-size": size,
          "line-height": lineHeight,
          "font-weight": "700",
          "margin-top": "0px",
          "margin-bottom": "0px",
          color: content,
        });

      const texts = {
        "Texto body": ["16px", "24px", content, "400"],
        "Texto muted": ["16px", "24px", muted, "400"],
        "Texto small": ["14px", "20px", muted, "400"],
        "Texto label": ["16px", "20px", content, "700"],
      };
      for (const [name, [size, lineHeight, color, weight]] of Object.entries(
        texts,
      ))
        await expectCss(page.getByText(name, { exact: true }), {
          "font-size": size,
          "line-height": lineHeight,
          color,
          "font-weight": weight,
          "margin-top": "0px",
          "margin-bottom": "0px",
        });

      await expectCss(page.getByRole("region", { name: "Tarjeta" }), {
        "border-top-left-radius": "20px",
        "padding-top": wide ? "32px" : "24px",
        "border-top-width": "1px",
        "border-top-color": "rgb(203, 216, 209)",
        "background-color": "rgb(255, 255, 255)",
      });

      const title = await box(heading("Kit de CheckPass"));
      const action = await box(page.getByRole("button", { name: "Accion" }));
      if (wide) {
        expect(action.x).toBeGreaterThan(title.x + title.width);
        expect(action.y).toBeLessThan(title.y + title.height);
      } else {
        expect(action.y).toBeGreaterThan(title.y + title.height);
      }

      const section = page.getByRole("group", { name: /Datos del negocio/ });
      await expect(section).toBeVisible();
      await expect(section.locator("legend")).toHaveCSS(
        "margin-bottom",
        "16px",
      );

      const save = page.getByRole("button", { name: "Guardar" });
      const actions = save.locator("..");
      await expect(actions).toHaveCSS(
        "flex-direction",
        wide ? "row" : "column-reverse",
      );
      const saveBox = await box(save);
      const cancelBox = await box(
        page.getByRole("button", { name: "Cancelar" }),
      );
      if (wide) {
        expect(saveBox.x).toBeGreaterThan(cancelBox.x);
      } else {
        expect(saveBox.y).toBeLessThan(cancelBox.y);
        expect(
          Math.abs(saveBox.width - (await box(actions)).width),
        ).toBeLessThanOrEqual(1);
      }
    });
  }

  test("tema oscuro: Text muted usa el token oscuro", async ({ page }) => {
    await open(page, 390, "dark");
    await expect(page.getByText("Texto muted", { exact: true })).toHaveCSS(
      "color",
      mutedDark,
    );
  });

  // Con `native` el navegador frena el envio por el `CheckboxField` requerido sin marcar (que
  // hereda el modo del Form); con el default `aria` del kit el envio llega a `onSubmit`.
  test("Form: el default validationBehavior=aria llega a los campos", async ({
    page,
  }) => {
    await open(page, 390);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("form")).toHaveAttribute(
      "data-submitted",
      "true",
    );
  });

  // Spec 0162: `errorMessage` del campo marca el campo y es su descripcion.
  test("errorMessage marca el campo", async ({ page }) => {
    await open(page, 390);
    const email = page.getByRole("textbox", { name: "Email" });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Ingresa un email valido");
  });

  // Spec 0162 (#76): sin `errorMessage`, los `validationErrors` del Form llegan a cada campo.
  test("Form: validationErrors del servidor llegan a los campos", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${harness.url}/?case=server-errors`);
    const fields = [
      ["textbox", "Nombre", "Nombre tomado", true],
      ["button", "Rubro", "Rubro invalido", false],
      ["textbox", "Sellos", "Minimo 2 sellos", true],
      ["textbox", "Notas", "Notas muy largas", true],
      ["radiogroup", "Plan", "Plan no disponible", true],
    ] as const;
    // soft: un rojo dice cuales campos fallan, no solo el primero.
    for (const [role, name, message, ariaInvalid] of fields) {
      const field = page.getByRole(role, { name });
      await expect.soft(field, name).toHaveAccessibleDescription(message);
      await expect.soft(page.getByText(message, { exact: true })).toBeVisible();
      // El boton del Select no lleva aria-invalid (medido en la spec).
      if (ariaInvalid)
        await expect.soft(field, name).toHaveAttribute("aria-invalid", "true");
    }
  });

  test.describe("capturas de Mac", () => {
    test.skip(
      Boolean(process.env.CI),
      "capturas de Mac: la CI corre en Linux (owner, 2026-10-05)",
    );
    for (const theme of themes)
      for (const width of widths)
        test(`captura ${theme} ${width}`, async ({ page }) => {
          await open(page, width, theme);
          // threshold 0: con el 0.2 por defecto un cambio de sombra (M4 de la 0159) pasaba verde.
          // Son capturas de la misma maquina: sin mutar, 0 es estable.
          await expect(page).toHaveScreenshot(`kit-${theme}-${width}.png`, {
            fullPage: true,
            animations: "disabled",
            threshold: 0,
          });
        });
  });
}
