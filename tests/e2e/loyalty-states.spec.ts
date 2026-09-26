import { expect } from "@playwright/test";
import {
  test,
  loyaltyFixture,
  next,
  pointsReview,
  storedProgram,
} from "./support/loyalty-fixture";
test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
for (const [status, code, text] of [
  [401, "unauthorized", "Tu sesión terminó"],
  [403, "not_member", "membresía activa"],
  [403, "missing_permission", "permiso para administrar"],
  [403, "email_not_verified", "Verificá tu email"],
  [403, "business_suspended", "suspendida"],
  [403, "business_closed", "cerrado"],
  [400, "invalid_body", "Revisá los datos"],
  [409, "program_exists", "estado del programa cambió"],
  [503, "program_unavailable", "no está disponible"],
] as const)
  test(`write ${status} ${code}: persistente y borrador`, async ({
    page,
    loyaltyHarness,
  }) => {
    const api = await loyaltyFixture(page);
    api.failWrite = status;
    api.code = code;
    await page.goto(loyaltyHarness);
    await pointsReview(page);
    await page.getByRole("button", { name: "Activar programa" }).click();
    await expect(page.getByRole("alert")).toContainText(text);
    if (status === 401 || status === 403)
      await expect(
        page.getByRole("button", { name: "Activar programa" }),
      ).toBeDisabled();
    await page.getByRole("button", { name: "Atrás" }).click();
    await expect(
      page.getByRole("textbox", { name: "Nombre del premio" }),
    ).toHaveValue("Café gratis");
    expect(api.writes).toHaveLength(1);
  });
test("staff email error no solicita verificación; catálogo403 no bloquea premio libre", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  api.failCatalog = 403;
  await page.goto(`${loyaltyHarness}?staff`);
  await pointsReview(page);
  api.failWrite = 403;
  api.code = "email_not_verified";
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(page.getByRole("button", { name: "Enviar enlace" })).toHaveCount(
    0,
  );
});
test("creación sellos recorre todas superficies y payload sin plural inventado", async ({
  page,
  loyaltyHarness,
}, info) => {
  const api = await loyaltyFixture(page);
  await page.goto(loyaltyHarness);
  await page.getByRole("radio", { name: /Sellos Una tarjeta/ }).focus();
  await page.keyboard.press("Space");
  await next(page);
  await page.getByRole("textbox", { name: "Nombre del sello" }).fill("Visita");
  await page.getByRole("textbox", { name: "Sellos para completar" }).fill("8");
  await next(page);
  await page.getByRole("checkbox", { name: /Usar degradé/ }).focus();
  await page.keyboard.press("Space");
  await page.screenshot({
    path: info.outputPath("design.png"),
    fullPage: true,
  });
  await next(page);
  await page
    .getByRole("textbox", { name: "Texto de términos" })
    .fill("Condiciones sellos");
  await page.getByRole("radio", { name: "Por compra", exact: true }).focus();
  await page.keyboard.press("Space");
  await next(page);
  await page.getByRole("radio", { name: "Descuento %", exact: true }).focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("textbox", { name: "Porcentaje de descuento" })
    .fill("15");
  await next(page);
  await page.screenshot({
    path: info.outputPath("review.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes[0].body).toMatchObject({
    kind: "stamps",
    configuration: { unitName: "Visita", target: 8 },
    rewards: [{ type: "discount", discountPercent: 15, pointsCost: null }],
    accrual: { mode: "per_purchase", grant: 10, blockAmount: null },
  });
  expect(api.writes[0].body.configuration).not.toHaveProperty("unitPlural");
  await page.screenshot({
    path: info.outputPath("active.png"),
    fullPage: true,
  });
});
test("edición puntos, vacío NaN y minmax visibles; teclado y descarte conserva", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  api.program = {
    ...storedProgram,
    kind: "points",
    configuration: { unitSingular: "Crédito", unitPlural: "Créditos" },
    accrual: { mode: "per_amount", grant: 5, blockAmount: 2 },
    rewards: [{ type: "custom", label: "Premio", pointsCost: 10 }],
    redeemAllowInsufficient: false,
  };
  await page.goto(loyaltyHarness);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await page
    .getByRole("textbox", { name: "Nombre singular", exact: true })
    .fill("");
  await next(page);
  await expect(page.getByText("Completá este nombre")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nombre singular", exact: true })
    .fill("Crédito nuevo");
  await next(page);
  await page.getByRole("textbox", { name: "Puntos otorgados" }).fill("");
  await next(page);
  await expect(page.getByText("Ingresá un entero mayor que 0")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Puntos otorgados" }),
  ).toHaveValue("");
  await page.getByRole("textbox", { name: "Puntos otorgados" }).fill("0");
  await next(page);
  await expect(page.getByText("Ingresá un entero mayor que 0")).toBeVisible();
  await page.getByRole("textbox", { name: "Puntos otorgados" }).fill("7");
  await next(page);
  await page.getByRole("checkbox", { name: /Permitir canjes/ }).focus();
  await page.keyboard.press("Space");
  await next(page);
  await page.getByRole("link", { name: "Volver al Backoffice" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-describedby", /./);
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes[0].body.configuration).toEqual({
    unitSingular: "Crédito nuevo",
    unitPlural: "Créditos",
  });
  expect(api.writes[0].body.redeemAllowInsufficient).toBe(true);
});
test("cierre fechas zona y confirmaciones DELETE PATCH; staff consulta cierre", async ({
  page,
  loyaltyHarness,
}, info) => {
  const api = await loyaltyFixture(page, true);
  await page.goto(loyaltyHarness);
  await page
    .getByRole("button", { name: "Cerrar programa", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar con el cierre" }).click();
  await expect(page.getByText("Elegí una fecha futura válida")).toBeVisible();
  await page
    .getByLabel("Fin de acumulación", { exact: true })
    .fill("2030-01-01T10:00");
  await page
    .getByLabel("Fecha final de canje", { exact: true })
    .fill("2030-01-01T09:00");
  await page.getByRole("button", { name: "Continuar con el cierre" }).click();
  await expect(page.getByText("El canje debe terminar después")).toBeVisible();
  await page
    .getByLabel("Fecha final de canje", { exact: true })
    .fill("2030-01-02T10:00");
  await page.getByRole("button", { name: "Continuar con el cierre" }).click();
  await expect(page.getByRole("dialog")).toContainText("America/Guayaquil");
  await page.screenshot({
    path: info.outputPath("close-confirm.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Programar cierre", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancelar cierre", exact: true }),
  ).toBeVisible();
  expect(api.writes[0]).toEqual({
    method: "DELETE",
    body: {
      earningEndsAt: "2030-01-01T10:00",
      redemptionEndsAt: "2030-01-02T10:00",
    },
  });
  await page
    .getByRole("button", { name: "Cancelar cierre", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar cierre", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes[1]).toEqual({
    method: "PATCH",
    body: { action: "cancel-close" },
  });
  api.program = { ...api.program, status: "closing" };
  await page.goto(`${loyaltyHarness}?staff`);
  await expect(
    page.getByRole("button", { name: "Cancelar cierre", exact: true }),
  ).toHaveCount(0);
});
test("catálogo fallo y vacío distintos, snapshot no desaparece al reseleccionar", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  api.failCatalog = 503;
  await page.goto(loyaltyHarness);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await next(page);
  await next(page);
  await next(page);
  await expect(
    page.getByText("No pudimos consultar el catálogo"),
  ).toBeVisible();
  await expect(page.getByText("No hay productos en tu catálogo")).toHaveCount(
    0,
  );
  api.failCatalog = 0;
  await page.getByRole("button", { name: "Reintentar catálogo" }).click();
  await page.getByRole("button", { name: /Café guardado Producto/ }).click();
  await page.getByRole("option", { name: "Café guardado" }).click();
  await next(page);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes[0].body.rewards).toMatchObject([{ productId: "missing" }]);
});
test("write JSON inválido no anuncia éxito ni descarta y consulta GET preserva", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  api.invalidWrite = true;
  await page.goto(loyaltyHarness);
  await pointsReview(page);
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(
    page.getByText("No pudimos confirmar el resultado", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Consultar programa" }).click();
  await expect(
    page.getByRole("button", { name: "Activar programa" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del premio" }),
  ).toHaveValue("Café gratis");
  expect(api.writes).toHaveLength(1);
});
