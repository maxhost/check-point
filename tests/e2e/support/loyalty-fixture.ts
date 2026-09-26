import { test as base, type Page } from "@playwright/test";
import { startCatalogHarness } from "./catalog-harness-server";
export const business = {
  name: "Café",
  countryCode: "EC",
  currencyCode: "USD",
  timezone: "America/Guayaquil",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
};
export const storedProgram = {
  id: "program-1",
  kind: "stamps",
  configuration: { unitName: "Visita", unitPlural: "Visitas", target: 8 },
  status: "active",
  activatedAt: "2026-01-01T00:00:00Z",
  earningEndsAt: null,
  redemptionEndsAt: null,
  termsMarkdown: "Términos guardados",
  stampImagePath: null,
  cardBackgroundColor: "#176548",
  cardBackgroundColor2: null,
  cardBackgroundGradientAngle: null,
  cardBorderColor: "#E78132",
  accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
  rewards: [
    {
      type: "catalog_product",
      label: "Café guardado",
      productId: "missing",
      discountPercent: null,
      pointsCost: null,
      position: 0,
      imagePath: null,
    },
  ],
  redeemAllowInsufficient: true,
};
export const test = base.extend<{ loyaltyHarness: string }>({
  loyaltyHarness: [
    async ({ browserName }, use) => {
      void browserName;
      const harness = await startCatalogHarness(
        "tests/e2e/support/loyalty-entry.tsx",
      );
      try {
        await use(harness.url);
      } finally {
        await harness.close();
      }
    },
    { scope: "test" },
  ],
});
export async function loyaltyFixture(page: Page, existing = false) {
  const api = {
    program: existing
      ? (structuredClone(storedProgram) as Record<string, unknown>)
      : (null as Record<string, unknown> | null),
    writes: [] as { method: string; body: Record<string, unknown> }[],
    catalogReads: 0,
    uploads: 0,
    reads: 0,
    failRead: 0,
    failCatalog: 0,
    failWrite: 0,
    code: "program_unavailable",
    delay: 0,
    invalidWrite: false,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = {};
    let status = 200;
    if (path === "/api/loyalty-program") {
      if (request.method() === "GET") {
        api.reads++;
        if (api.failRead) {
          status = api.failRead;
          body = { code: api.code, error: "texto arbitrario" };
        } else body = { business, program: api.program };
      } else {
        const payload = request.postDataJSON() as Record<string, unknown>;
        api.writes.push({ method: request.method(), body: payload });
        if (api.delay)
          await new Promise((resolve) => setTimeout(resolve, api.delay));
        if (api.failWrite) {
          status = api.failWrite;
          body = { code: api.code, error: "texto arbitrario" };
        } else if (api.invalidWrite) {
          body = "bad";
        } else {
          if (request.method() === "PUT") {
            const configuration = payload.configuration as Record<
              string,
              unknown
            >;
            api.program = {
              ...structuredClone(storedProgram),
              kind: payload.kind,
              configuration,
              termsMarkdown: (payload.clauses as { text: string }[])[0].text,
              accrual: {
                ...(payload.accrual as Record<string, unknown>),
                blockAmount:
                  (payload.accrual as Record<string, unknown>).blockAmount ===
                  null
                    ? null
                    : Number(
                        (payload.accrual as Record<string, unknown>)
                          .blockAmount,
                      ),
              },
              ...((payload.cardDesign as Record<string, unknown> | undefined)
                ? {
                    cardBackgroundColor: (
                      payload.cardDesign as Record<string, unknown>
                    ).backgroundColor,
                    cardBackgroundColor2: (
                      payload.cardDesign as Record<string, unknown>
                    ).backgroundColor2,
                    cardBackgroundGradientAngle: (
                      payload.cardDesign as Record<string, unknown>
                    ).gradientAngle,
                    cardBorderColor: (
                      payload.cardDesign as Record<string, unknown>
                    ).borderColor,
                  }
                : {}),
              rewards: (payload.rewards as Record<string, unknown>[]).map(
                (reward) => ({
                  productId: null,
                  discountPercent: null,
                  pointsCost: null,
                  position: 0,
                  imagePath: null,
                  ...reward,
                  label:
                    reward.label ??
                    (reward.type === "discount"
                      ? `${reward.discountPercent}% de descuento`
                      : "Café guardado"),
                }),
              ),
              redeemAllowInsufficient: payload.redeemAllowInsufficient,
            };
            body = { programId: "program-1", created: !existing };
            status = existing ? 200 : 201;
          } else if (request.method() === "DELETE") {
            api.program = {
              ...api.program,
              status: "closing",
              earningEndsAt: "2030-01-01T15:00:00Z",
              redemptionEndsAt: "2030-01-02T15:00:00Z",
            };
            body = { ok: true };
          } else {
            api.program = {
              ...api.program,
              status: "active",
              earningEndsAt: null,
              redemptionEndsAt: null,
            };
            body = { ok: true };
          }
        }
      }
    } else if (path === "/api/loyalty-terms/templates")
      body = {
        templates: [
          {
            id: "t1",
            title: "Plantilla",
            templateMarkdown: "Términos para {{business_legal_name}}",
          },
        ],
      };
    else if (path === "/api/loyalty-program/stamp-upload") {
      api.uploads++;
      body = {
        uploadId: "stamp-upload-1",
        uploadUrl: new URL("/signed-stamp", request.url()).href,
      };
    } else if (path === "/api/catalog") {
      api.catalogReads++;
      status = api.failCatalog || 200;
      body = api.failCatalog
        ? { code: "missing_permission" }
        : { products: [{ id: "coffee", name: "Café", unitPrice: 5 }] };
    } else if (path === "/api/merchant/auth/verify-email")
      body = { verified: true, sent: false };
    else body = {};
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/signed-stamp", (route) =>
    route.fulfill({ status: 200 }),
  );
  return api;
}
export const next = async (page: Page) =>
  page.getByRole("button", { name: "Continuar", exact: true }).click();
export async function pointsReview(page: Page) {
  await next(page);
  await page
    .getByRole("textbox", { name: "Nombre singular", exact: true })
    .fill("Crédito");
  await page
    .getByRole("textbox", { name: "Nombre plural", exact: true })
    .fill("Créditos");
  await next(page);
  await page
    .getByRole("textbox", { name: "Texto de términos" })
    .fill("Condiciones nuevas");
  await page.getByRole("textbox", { name: "Monto por bloque" }).fill("5,50");
  await next(page);
  await page
    .getByRole("textbox", { name: "Nombre del premio" })
    .fill("Café gratis");
  await next(page);
}
