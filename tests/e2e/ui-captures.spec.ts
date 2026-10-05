import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { brandFixture } from "./support/brand-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { loyaltyFixture } from "./support/loyalty-fixture";
import {
  choosePlace,
  onboardingPlacesFixture,
} from "./support/onboarding-places-fixture";

// Spec 0158 / ADR 0123: capturas para que el owner compare pantallas antes y despues de un
// cambio de CSS. No es un oraculo (no corre en verify): `UI_CAPTURES_DIR=<dir> pnpm exec
// playwright test tests/e2e/ui-captures.spec.ts`.
const dir = process.env.UI_CAPTURES_DIR;
test.skip(!dir, "solo con UI_CAPTURES_DIR");
test.use({ colorScheme: "light", reducedMotion: "reduce" });

const counterResolved = {
  consumer: { displayName: "Cliente de prueba" },
  membership: {
    id: "member-1",
    pointsBalance: 20,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: {
    id: "program-1",
    kind: "points",
    redeemAllowInsufficient: false,
    accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
    cardDesign: {
      backgroundColor: null,
      backgroundColor2: null,
      gradientAngle: null,
      borderColor: null,
    },
  },
  catalog: {
    products: [
      {
        id: "product-1",
        name: "Pan",
        categoryId: null,
        unitPrice: 2,
        imagePath: null,
      },
    ],
    categories: [],
    habitualProductIds: [],
    lastPurchase: null,
  },
  rewards: [],
  couponState: { status: "none" },
};

type Surface = {
  name: string;
  entry?: string;
  open: (page: Page, url: string) => Promise<void>;
};

const surfaces: Surface[] = [
  { name: "onboarding", open: (page) => onboardingPlacesFixture(page) },
  {
    name: "onboarding-lugar",
    open: async (page) => {
      await onboardingPlacesFixture(page);
      await choosePlace(page);
    },
  },
  {
    name: "mostrador",
    entry: "tests/e2e/support/counter-harness.tsx",
    open: async (page, url) => {
      await page.route("**/api/counter/resolve", (route) =>
        route.fulfill({ json: counterResolved }),
      );
      await page.goto(url);
      await expect(
        page.getByRole("button", { name: "Escanear", exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "programa",
    entry: "tests/e2e/support/loyalty-entry.tsx",
    open: async (page, url) => {
      await loyaltyFixture(page);
      await page.goto(url);
      await expect(page.getByRole("button").first()).toBeVisible();
    },
  },
  {
    name: "marca",
    entry: "tests/e2e/support/loyalty-regression-entry.tsx",
    open: async (page, url) => {
      await brandFixture(page);
      await page.goto(`${url}?surface=brand`);
      await expect(
        page.getByRole("textbox", { name: "Nombre del negocio" }),
      ).toBeVisible();
    },
  },
  {
    name: "catalogo",
    entry: "tests/e2e/support/loyalty-regression-entry.tsx",
    open: async (page, url) => {
      await catalogApiFixture(page);
      await page.goto(`${url}?surface=catalog`);
      await expect(
        page.getByRole("button", { name: "Importar con IA" }),
      ).toBeVisible();
    },
  },
  {
    name: "staff",
    entry: "tests/e2e/support/loyalty-regression-entry.tsx",
    open: async (page, url) => {
      await page.route("**/api/**", (route) =>
        route.fulfill({
          json:
            new URL(route.request().url()).pathname === "/api/merchant/session"
              ? {
                  authenticated: true,
                  user: { id: "owner" },
                  membership: { role: "owner", permissions: ["staff"] },
                }
              : { staff: [] },
        }),
      );
      await page.goto(`${url}?surface=staff`);
      await page.getByRole("button", { name: /Añadir integrante/ }).click();
      await expect(
        page.getByRole("textbox", { name: "Nombre", exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "locales",
    entry: "tests/e2e/support/loyalty-regression-entry.tsx",
    open: async (page, url) => {
      await page.goto(`${url}?surface=locations`);
      await page.getByRole("button", { name: /Añadir local/ }).click();
      await expect(
        page.getByRole("textbox", { name: "Nombre del local" }),
      ).toBeVisible();
    },
  },
];

for (const surface of surfaces)
  for (const width of [390, 1280])
    test(`captura ${surface.name} ${width}`, async ({ page }) => {
      const harness = surface.entry
        ? await startCatalogHarness(surface.entry)
        : undefined;
      try {
        await page.setViewportSize({ width, height: 900 });
        await surface.open(page, harness?.url ?? "");
        await mkdir(dir!, { recursive: true });
        await page.screenshot({
          path: path.join(dir!, `${surface.name}-${width}.png`),
          fullPage: true,
        });
      } finally {
        await harness?.close();
      }
    });
