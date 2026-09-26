import { expect } from "@playwright/test";
import {
  test,
  loyaltyFixture,
  next,
  storedProgram,
} from "./support/loyalty-fixture";
for (const width of [320, 390, 768, 1280])
  for (const theme of ["light", "dark"] as const)
    test(`superficies y controles ${width} ${theme}`, async ({
      page,
      loyaltyHarness,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const api = await loyaltyFixture(page, true);
      await page.goto(loyaltyHarness);
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const capture = async (name: string) => {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
        ).toBe(false);
        await page.screenshot({
          path: info.outputPath(`${name}-${width}-${theme}.png`),
          fullPage: true,
        });
      };
      await capture("consulta");
      await page.getByRole("button", { name: "Editar programa" }).click();
      await capture("basics");
      await next(page);
      const mark = page.locator(".cp-checkbox-mark");
      const geometry = await mark.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const parent = getComputedStyle(element.parentElement!);
        return {
          width: rect.width,
          height: rect.height,
          display: parent.display,
          color: parent.color,
        };
      });
      expect(geometry.width).toBe(20);
      expect(geometry.height).toBe(20);
      expect(geometry.display).toBe("flex");
      expect(geometry.color).toBe(
        await page
          .locator(".loyalty-page")
          .evaluate((element) => getComputedStyle(element).color),
      );
      await capture("design");
      await next(page);
      const textarea = page.getByRole("textbox", { name: "Texto de términos" });
      expect(
        await textarea.evaluate(
          (element) => getComputedStyle(element).fontSize,
        ),
      ).toBe("16px");
      await capture("terms");
      await next(page);
      await capture("rewards");
      await next(page);
      await capture("review");
      await page.getByRole("link", { name: "Volver al Backoffice" }).click();
      const overlay = page.locator(".loyalty-dialog-overlay");
      expect(
        await overlay.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      ).not.toBe("rgba(0, 0, 0, 0)");
      await capture("discard-dialog");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Salir sin guardar" })
        .click();
      await page
        .getByRole("button", { name: "Cerrar programa", exact: true })
        .click();
      await capture("closing-form");
      api.program = {
        ...storedProgram,
        status: "closing",
        earningEndsAt: "2030-01-01T15:00:00Z",
        redemptionEndsAt: "2030-01-02T15:00:00Z",
      };
      await page.reload();
      await capture("closing-summary");
      await page
        .getByRole("button", { name: "Cancelar cierre", exact: true })
        .click();
      await capture("cancel-dialog");
    });
