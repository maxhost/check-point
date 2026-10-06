import { expect, test, type Locator, type Page } from "@playwright/test";
import { startCatalogHarness } from "./catalog-harness-server";

// Spec 0159: oraculos del kit. Los registran ui-kit.spec.ts (Chromium) y ui-kit.webkit.spec.ts.
// Oraculo 1 (estilos computados) corre en todos lados; oraculo 2 (capturas de Mac) no en la CI.
const content = "rgb(16, 37, 29)";
const muted = "rgb(82, 100, 91)";
const primary = "rgb(23, 101, 72)";
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

  // Spec 0160: overlays y navegacion.
  for (const width of widths) {
    test(`ConfirmDialog en ${width}: foco, estilos, Escape`, async ({
      page,
    }) => {
      await open(page, width);
      const trigger = page.getByRole("button", { name: "Abrir confirmacion" });
      await trigger.click();
      const dialog = page.getByRole("alertdialog", {
        name: "¿Archivar el local?",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("data-tour", "kit-confirm");
      await expect(dialog).toHaveAccessibleDescription(
        "Deja de aparecer en el mostrador.",
      );
      await expect(
        dialog.getByRole("button", { name: "Cancelar" }),
      ).toBeFocused();
      await expectCss(
        dialog.getByRole("heading", { name: "¿Archivar el local?" }),
        {
          "font-size": "20px",
          "font-weight": "700",
        },
      );
      // La caja es el Modal que envuelve al dialog.
      await expectCss(dialog.locator(".."), {
        "border-top-left-radius": "20px",
      });
      // Spec 0161: con la pagina mas larga, en 390 el puntero del clic en «Abrir confirmacion»
      // quedaba sobre «Archivar» (medido: el color de hover, rgb(116, 32, 32)). Se lo saca.
      await page.mouse.move(0, 0);
      const danger = await page
        .getByRole("button", { name: "Peligro" })
        .evaluate((node) => getComputedStyle(node).backgroundColor);
      await expect(dialog.getByRole("button", { name: "Archivar" })).toHaveCSS(
        "background-color",
        danger,
      );
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test(`Combobox en ${width}: medida del TextField, lista, teclado`, async ({
      page,
    }) => {
      await open(page, width);
      const input = page.getByRole("combobox", { name: "Ciudad" });
      const reference = await page
        .getByRole("textbox", { name: "Nombre", exact: true })
        .evaluate((node) => {
          const css = getComputedStyle(node);
          return {
            "padding-left": css.paddingLeft,
            "padding-top": css.paddingTop,
            "border-top-left-radius": css.borderTopLeftRadius,
            "border-top-color": css.borderTopColor,
            "min-height": css.minHeight,
            "font-size": css.fontSize,
          };
        });
      await expectCss(input, reference);
      // Scroll ANTES de escribir: React Aria cierra la lista ante un scroll y repone el texto, y el
      // scroll de `fill`/`click` llega despues de la primera tecla (medido: «cu» quedaba «u»).
      await input.scrollIntoViewIfNeeded();
      await page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      await input.click();
      await page.keyboard.type("cu");
      const listbox = page.getByRole("listbox");
      await expect(listbox.getByRole("option")).toHaveCount(1);
      await expect(
        listbox.getByRole("option", { name: "Cuenca" }),
      ).toBeVisible();
      // La caja es el Popover (padre de la listbox), del ancho del input.
      expect(
        Math.abs(
          (await box(listbox.locator(".."))).width - (await box(input)).width,
        ),
      ).toBeLessThanOrEqual(1);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(page.getByText("Elegida: Cuenca")).toBeVisible();
    });
  }

  test("Dialog: nombre y descripcion", async ({ page }) => {
    await open(page, 1280);
    await page.getByRole("button", { name: "Abrir dialogo" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar nombre" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription("Lo ven tus clientes.");
  });

  test("Tabs, SegmentedControl, Switch, ProgressBar y Link", async ({
    page,
  }) => {
    await open(page, 1280);

    const products = page.getByRole("tab", { name: "Productos" });
    const categories = page.getByRole("tab", { name: "Categorias" });
    await expect(products).toHaveCSS("border-bottom-color", primary);
    await products.focus();
    await page.keyboard.press("ArrowRight");
    await expect(categories).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Panel categorias")).toBeVisible();
    await expect(categories).toHaveCSS("border-bottom-color", primary);

    await expect(
      page.getByRole("radiogroup", { name: "Buscar por" }),
    ).toBeVisible();
    const byName = page.getByRole("radio", { name: "Nombre" });
    const byPhone = page.getByRole("radio", { name: "Telefono" });
    await expect(byName).toHaveAttribute("aria-checked", "true");
    await byPhone.click();
    await expect(byPhone).toHaveAttribute("aria-checked", "true");
    await expect(byPhone).toHaveCSS("background-color", primary);
    await expect(byName).toHaveAttribute("aria-checked", "false");

    const testMode = page.getByRole("switch", { name: "Modo prueba" });
    await expect(testMode).not.toBeChecked();
    await page.getByText("Modo prueba").click();
    await expect(testMode).toBeChecked();
    await expect(
      page.getByRole("switch", { name: "Notificaciones" }),
    ).toBeChecked();

    const progress = page.getByRole("progressbar", { name: "Configuracion" });
    await expect(progress).toHaveAttribute("aria-valuenow", "40");
    // El relleno es el unico elemento con `style` (la excepcion del ADR 0123 §2); la pista, su padre.
    const fill = progress.locator('[style*="width"]');
    const track = fill.locator("..");
    expect(
      Math.abs((await box(fill)).width - 0.4 * (await box(track)).width),
    ).toBeLessThanOrEqual(1);

    await expectCss(page.getByRole("link", { name: "Ver ayuda" }), {
      color: primary,
      "text-decoration-line": "underline",
    });
    const panel = page.getByRole("link", { name: "Ir al panel" });
    await expect(panel).toHaveAttribute("href", "#panel");
    await expectCss(panel, { "min-height": "44px", "border-top-width": "1px" });
  });

  // Spec 0161: campos especiales. «Valor: …» es lo ultimo que emitio cada pieza.
  const emitted = (page: Page, kit: string) =>
    page.locator(`[data-kit="${kit}"]`).getByText(/^Valor:/);

  // React Aria envuelve los segmentos en marcas de direccion (U+2066..U+2069): se sacan para leer.
  const plainText = (target: Locator) =>
    target.evaluate((node) =>
      (node.textContent ?? "").replace(/[\u2066-\u2069]/g, ""),
    );

  async function inputReference(page: Page) {
    return page
      .getByRole("textbox", { name: "Nombre", exact: true })
      .evaluate((node) => {
        const css = getComputedStyle(node);
        return {
          "border-top-left-radius": css.borderTopLeftRadius,
          "border-top-color": css.borderTopColor,
          "border-top-width": css.borderTopWidth,
          "min-height": css.minHeight,
        };
      });
  }

  for (const width of widths) {
    test(`TimeField y DateTimeField en ${width}: formato, valor, calendario`, async ({
      page,
    }) => {
      await open(page, width);
      const time = page.locator('[data-kit="time"]');
      const dateTime = page.locator('[data-kit="date-time"]');
      // Orden dia/mes/año y 24 h fijos aunque Playwright corra en en-US.
      await expect
        .poll(() => plainText(time.getByRole("group", { name: "Apertura" })))
        .toBe("09:00");
      const group = dateTime.getByRole("group", {
        name: "Inicio de la campaña",
        exact: true,
      });
      await expect.poll(() => plainText(group)).toBe("15/10/2026, 09:30");
      await expectCss(
        dateTime.locator('[data-rac][role="group"]').first(),
        await inputReference(page),
      );

      await time.getByRole("spinbutton", { name: /hora/i }).click();
      await page.keyboard.type("14");
      await expect(emitted(page, "time")).toHaveText("Valor: 14:00");

      await dateTime.getByRole("spinbutton", { name: /minuto/i }).focus();
      await page.keyboard.press("ArrowUp");
      await expect(emitted(page, "date-time")).toHaveText(
        "Valor: 2026-10-15T09:31",
      );

      await dateTime.getByRole("button", { name: "Abrir calendario" }).click();
      const calendar = page.getByRole("dialog");
      await expect(calendar).toBeVisible();
      await expect(
        calendar.getByRole("heading", { name: "octubre de 2026" }),
      ).toBeVisible();
      // Nombres de dia como «sábado, 3 de octubre de 2026».
      await expect(
        calendar.getByRole("button", { name: /, 3 de octubre/ }),
      ).toBeDisabled();
      await calendar.getByRole("button", { name: /, 20 de octubre/ }).click();
      await expect(calendar).toBeHidden();
      await expect(emitted(page, "date-time")).toHaveText(
        "Valor: 2026-10-20T09:31",
      );
    });

    test(`SearchField en ${width}: lupa, borrar, Escape`, async ({ page }) => {
      await open(page, width);
      const search = page.getByRole("searchbox", { name: "Buscar producto" });
      const clear = page.getByRole("button", { name: "Borrar búsqueda" });
      await expectCss(search, await inputReference(page));
      await expect(clear).toBeHidden();
      await search.fill("pan");
      await expect(emitted(page, "search")).toHaveText("Valor: pan");
      await expect(clear).toBeVisible();
      await clear.click();
      await expect(search).toHaveValue("");
      await expect(emitted(page, "search")).toHaveText("Valor:");
      await search.fill("pan");
      await search.press("Escape");
      await expect(search).toHaveValue("");
      // La lupa queda a la izquierda del texto.
      const icon = await box(
        page.locator('[data-kit="search"] svg[aria-hidden="true"]').first(),
      );
      const paddingLeft = await search.evaluate((node) =>
        parseFloat(getComputedStyle(node).paddingLeft),
      );
      expect((await box(search)).x + paddingLeft).toBeGreaterThan(
        icon.x + icon.width,
      );
    });
  }

  test("ColorField, Slider y FileButton", async ({ page }) => {
    await open(page, 1280);

    const hex = page.getByRole("textbox", {
      name: "Color primario",
      exact: true,
    });
    const swatch = page.getByLabel("Elegir color color primario");
    await expect(hex).toHaveValue("#176548");
    await expect(page.locator('[data-tour="kit-color"]')).toContainText(
      "Color primario",
    );
    await swatch.fill("#1a2b3c");
    await expect(emitted(page, "color")).toHaveText("Valor: #1A2B3C");
    await hex.fill("#12");
    await expect(emitted(page, "color")).toHaveText("Valor: #12");
    await expect(swatch).toHaveValue("#000000");

    const zoom = page.getByRole("slider", { name: "Zoom" });
    // React Aria usa un input range nativo: el valor es `value`, no `aria-valuenow`.
    await expect(zoom).toHaveValue("1");
    await zoom.focus();
    await page.keyboard.press("ArrowRight");
    await expect(zoom).toHaveValue("1.5");
    await expect(emitted(page, "slider")).toHaveText("Valor: 1.5");
    // El tramo lleno: el elemento con `style` de ancho que no es el envoltorio oculto del input.
    const fill = page.locator(
      '[data-kit="slider"] [style*="width"]:not(:has(input))',
    );
    expect(
      Math.abs(
        (await box(fill)).width - (await box(fill.locator(".."))).width / 6,
      ),
    ).toBeLessThanOrEqual(1);

    const file = page.getByLabel("Archivo de prueba");
    await expect(file).toHaveAttribute("accept", "image/png,image/jpeg");
    await expect(page.getByLabel("Foto de prueba")).toHaveAttribute(
      "capture",
      "environment",
    );
    await file.setInputFiles({
      name: "prueba.png",
      mimeType: "image/png",
      buffer: Buffer.from("png"),
    });
    await expect(emitted(page, "file")).toHaveText("Valor: prueba.png");
    const upload = page.getByRole("button", { name: "Subir imagen" });
    await expectCss(upload, {
      "min-height": "44px",
      "border-top-width": "1px",
    });
    const chooser = page.waitForEvent("filechooser");
    await upload.click();
    expect((await chooser).isMultiple()).toBe(false);
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
    // Spec 0160: el ConfirmDialog abierto (caso aparte: la pagina por defecto lo tiene cerrado).
    for (const theme of themes)
      for (const width of widths)
        test(`captura dialogo ${theme} ${width}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({
            colorScheme: theme,
            reducedMotion: "reduce",
          });
          await page.goto(`${harness.url}/?case=dialog&theme=${theme}`);
          await expect(page.getByRole("alertdialog")).toBeVisible();
          await expect(page).toHaveScreenshot(
            `kit-dialog-${theme}-${width}.png`,
            { animations: "disabled", threshold: 0 },
          );
        });
    // Spec 0161: el calendario del DateTimeField abierto.
    for (const theme of themes)
      for (const width of widths)
        test(`captura calendario ${theme} ${width}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({
            colorScheme: theme,
            reducedMotion: "reduce",
          });
          // Reloj fijo: el calendario marca «hoy» y la captura no puede depender del dia.
          await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
          await page.goto(`${harness.url}/?case=calendar&theme=${theme}`);
          await expect(page.getByRole("dialog")).toBeVisible();
          await expect(page).toHaveScreenshot(
            `kit-calendar-${theme}-${width}.png`,
            { animations: "disabled", threshold: 0 },
          );
        });
  });
}
