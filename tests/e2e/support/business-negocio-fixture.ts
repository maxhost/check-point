import type { Page } from "@playwright/test";
import type {
  BusinessCommission,
  BusinessPaymentMethod,
  ChargeShape,
} from "../../../apps/merchant/src/lib/business-contract";
function method(
  id: string,
  name: string,
  chargeShape: ChargeShape,
  isCash = false,
): BusinessPaymentMethod {
  return {
    id,
    name,
    chargeShape,
    isCash,
    status: "active",
    commission: {
      providerId: "core",
      methodId: id,
      name,
      chargeShape,
      status: "active",
      revisionId: null,
      percent: null,
      fixed: null,
      originalFixed: null,
      fixedNormalizationAdjustment: null,
      currencyCode: null,
      minorUnit: null,
      configured: chargeShape === "none",
    },
  };
}
export async function apiFixture(page: Page) {
  const api = {
    methods: [
      method("cash", "Efectivo", "none", true),
      method("card", "Tarjeta", "percent"),
      method("fixed", "Transferencia", "fixed"),
      method("mixed", "Mixto", "percent_and_fixed"),
    ],
    regional: {
      timezone: "America/Guayaquil",
      currencyCode: "USD",
      revision: 1,
    },
    fiscal: {
      chargesVat: false,
      saleVatRate: null as string | null,
      recoversPurchaseVat: false,
      revision: 1,
    },
    units: { salesMassUnits: ["kg"] as ("kg" | "lb" | "g")[], revision: 1 },
    errorFields: undefined as { salesMassUnits: string } | undefined,
    errorProducts: undefined as { id: string; name: string }[] | undefined,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    reads: [] as string[],
    fail: 0,
    failRead: 0,
    hold: null as Promise<void> | null,
  };
  await page.route("**/api/business/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/api/business/",
      "",
    );
    if (route.request().method() === "GET") {
      api.reads.push(path);
      if (api.failRead)
        return route.fulfill({
          status: api.failRead,
          json: { error: "No tienes acceso.", code: "forbidden" },
        });
      if (path === "payment-methods")
        return route.fulfill({
          json: { methods: api.methods, defaultMethodId: "cash" },
        });
      if (path === "payment-method-catalog")
        return route.fulfill({
          json: {
            countryCode: "EC",
            source: "country",
            entries: [
              {
                id: "catalog-deuna",
                name: "DeUna",
                chargeShape: "percent",
                isCash: false,
                initiallySuggested: true,
              },
            ],
          },
        });
      return route.fulfill({
        json:
          path === "regional"
            ? api.regional
            : path === "fiscal"
              ? api.fiscal
              : api.units,
      });
    }
    const body = route.request().postDataJSON();
    api.writes.push({ path, body });
    if (api.hold) await api.hold;
    if (api.fail)
      return route.fulfill({
        status: api.fail,
        json: {
          fields: api.errorFields,
          products: api.errorProducts,
          error:
            api.fail === 409
              ? "Otra sesión modificó los datos."
              : "No pudimos guardar los cambios.",
          code: path.endsWith("commission")
            ? "commission_revision_conflict"
            : api.errorProducts
              ? "unit_in_use"
              : "business_revision_conflict",
        },
      });
    if (path.endsWith("/commission")) {
      if (
        body.fixed != null &&
        body.expectedCurrencyCode !== api.regional.currencyCode
      ) {
        return route.fulfill({
          status: 409,
          json: {
            error: "La moneda del negocio cambió.",
            code: "commission_currency_conflict",
          },
        });
      }
      const item = api.methods.find((item) => item.id === path.split("/")[1])!;
      const fixed = typeof body.fixed === "string" ? body.fixed : null;
      const commission: BusinessCommission = {
        ...item.commission,
        revisionId: `revision-${api.writes.length}`,
        percent: body.percent ?? null,
        fixed,
        originalFixed:
          fixed === null
            ? null
            : {
                numerator: String(
                  BigInt(fixed.split(".")[0]) * 100n +
                    BigInt((fixed.split(".")[1] ?? "").padEnd(2, "0")),
                ),
                denominator: "1",
                scale: 2,
              },
        currencyCode: api.regional.currencyCode,
        minorUnit: 2,
        configured:
          (item.chargeShape === "fixed" || body.percent !== null) &&
          (item.chargeShape === "percent" || fixed !== null),
      };
      item.commission = commission;
      return route.fulfill({ json: { commission } });
    }
    if (path.endsWith("/archive")) {
      const item = api.methods.find((item) => item.id === path.split("/")[1])!;
      item.status = "archived";
      return route.fulfill({ json: { method: item } });
    }
    if (path === "payment-methods") {
      const item = body.catalogId
        ? method(`added-${api.methods.length}`, "DeUna", "percent")
        : method(`added-${api.methods.length}`, body.name, body.chargeShape);
      api.methods.push(item);
      return route.fulfill({ status: 201, json: { method: item } });
    }
    if (body.revision !== api.regional.revision)
      return route.fulfill({
        status: 409,
        json: {
          error: "Otra sesión modificó los datos.",
          code: "business_revision_conflict",
        },
      });
    const revision = api.regional.revision + 1;
    api.regional.revision = revision;
    api.fiscal.revision = revision;
    api.units.revision = revision;
    if (path === "regional")
      api.regional = { ...api.regional, ...body, revision };
    else if (path === "fiscal")
      api.fiscal = { ...api.fiscal, ...body, revision };
    else api.units = { ...api.units, ...body, revision };
    return route.fulfill({
      json:
        path === "regional"
          ? api.regional
          : path === "fiscal"
            ? api.fiscal
            : api.units,
    });
  });
  return api;
}
export async function choose(
  page: Page,
  name: string,
  option: string | RegExp,
) {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
export const row = (page: Page, name: string) =>
  page.getByRole("region", { name: `Medio ${name}`, exact: true });
