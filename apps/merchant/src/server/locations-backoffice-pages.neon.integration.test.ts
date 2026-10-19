import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { dropBusiness } from "./counter-integration-support";
import {
  integrationEnabled,
  seedExtraLocation,
  seedLocationsBusiness,
} from "./locations-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businessModules, locations } from "@mi-pasaporte/db/schema";

/** The session the two pages under test run with. Filled by `beforeAll` with the seeded
 * business; the guard itself (ADR 0044) has its own tests and is not re-tested here. */
const ctx = vi.hoisted(() => ({
  session: null as null | {
    userId: string;
    userName: string;
    business: {
      id: string;
      name: string;
      currencyCode: string;
      timezone: string;
    };
    membership: { role: string; status: string; permissions: string[] };
  },
}));

vi.mock("./auth-guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth-guards")>();
  return {
    ...actual,
    requireBackofficeSession: async () => ctx.session,
    requireOwner: async () => ctx.session,
  };
});

import { MODULES } from "../modules/registry";
import { moduleHref } from "../modules/navigation";
// The tile test isolates presentation from request-scoped billing; guards/billing have their own suites.
vi.mock("./backoffice-initial-context", () => ({
  readBackofficePagePlan: async () => ({ plan: "plus", status: "active" }),
}));

// These client widgets require their provider and are outside the tile/redirect contract.
vi.mock("../app/backoffice/analytics/dashboard-summary", () => ({
  DashboardSummary: () => null,
}));
vi.mock("../app/backoffice/analytics/inbox", () => ({
  AnalyticsInbox: () => null,
}));

import CounterPage from "../app/backoffice/counter/page";
import BackofficePage from "../app/backoffice/page";

/**
 * Spec 0061 — what the two backoffice SERVER pages hand down, against the real branch.
 * `CounterPage` is imported and its props inspected (the pattern `vitest.config.ts`
 * already documents); `BackofficePage` is rendered, because the DoD item is about the
 * tile's href.
 */
describe.skipIf(!integrationEnabled)(
  "backoffice pages and locations (spec 0061)",
  () => {
    let businessId: string;
    let activeId: string;
    let archivedId: string;

    beforeAll(async () => {
      const seed = await seedLocationsBusiness("Paginas", "plus");
      businessId = seed.business.id;
      archivedId = seed.locationId;
      activeId = await seedExtraLocation(businessId, "Sucursal Sur");
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, archivedId));
      ctx.session = {
        userId: seed.userId,
        userName: "Ana",
        business: {
          id: businessId,
          name: "Paginas",
          currencyCode: "USD",
          timezone: "America/Guayaquil",
        },
        membership: {
          role: "owner",
          status: "active",
          permissions: ["counter", "analytics"],
        },
      };
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(businessId);
    }, 60_000);

    async function redirectedLocation(location?: string): Promise<string> {
      try {
        await CounterPage({ searchParams: Promise.resolve({ location }) });
      } catch (error) {
        const digest = (error as { digest?: string }).digest;
        if (digest?.startsWith("NEXT_REDIRECT;")) return digest.split(";")[2];
        throw error;
      }
      throw new Error("Counter must redirect after retirement");
    }

    it("retired counter redirects and keeps only active locations of this business", async () => {
      expect(await redirectedLocation(activeId)).toBe(
        `/backoffice?location=${activeId}`,
      );
      expect(await redirectedLocation(archivedId)).toBe("/backoffice");
      expect(
        await redirectedLocation("00000000-0000-4000-8000-000000000001"),
      ).toBe("/backoffice");
      expect(await redirectedLocation()).toBe("/backoffice");
    }, 60_000);

    it("staff with only the active module permission can follow the old URL", async () => {
      const module = MODULES.find((entry) => entry.startPage);
      if (!module?.startPage || !ctx.session)
        throw new Error("module/session fixture missing");
      await getDb()
        .insert(businessModules)
        .values({ businessId, moduleId: module.id, enabled: true });
      const ownerMembership = ctx.session.membership;
      try {
        ctx.session.membership = {
          role: "staff",
          status: "active",
          permissions: [module.startPage.permission],
        };
        expect(await redirectedLocation(activeId)).toBe(
          `${moduleHref(module.id, module.startPage.path)}?location=${activeId}`,
        );
        ctx.session.membership.permissions = ["counter"];
        expect(await redirectedLocation(activeId)).toBe(
          `/backoffice/customers?location=${activeId}`,
        );
      } finally {
        ctx.session.membership = ownerMembership;
        await getDb()
          .delete(businessModules)
          .where(
            and(
              eq(businessModules.businessId, businessId),
              eq(businessModules.moduleId, module.id),
            ),
          );
      }
    }, 60_000);

    it("the «Locales» tile points at the real screen, not at the spec 0015 mock", async () => {
      const html = renderToStaticMarkup(await BackofficePage());
      expect(html).toContain('href="/backoffice/locations"');
      expect(html).not.toContain("/backoffice/demo/locations");
      // The spec 0015 mock (`/backoffice/demo/*`) is gone entirely — this asserts the
      // re-route was surgical and did not silently break the others. `campaigns` left
      // this list in spec 0065 (B3) and is asserted by
      // `marketing-backoffice-pages.neon.integration.test.ts`; `analytics` had no real
      // screen and its tile was removed instead of getting one.
      expect(html).not.toContain("/backoffice/demo/");
      // Spec 0067 §7-quinquies — this line USED to assert `href="/backoffice/staff"`, a
      // second real screen kept here as anti-false-green. That screen was DELETED (owner's
      // decision, 2026-09-17), so its subject no longer exists: this is not a test edited
      // to turn a gate green, it is a test whose object was removed, and the coverage it
      // gave —that the `staff` tile pointed at the real section— is GONE with it. What
      // replaces it is the oracle of the deletion itself: the tile must not be rendered at
      // all. Both spellings matter — dropping `staff` from `realModules` while leaving it
      // in `modules` would silently fall back to the spec 0015 mock, which is a live
      // placeholder page and not a 404.
      expect(html).not.toContain("/backoffice/staff");
      expect(html).not.toContain("/backoffice/demo/staff");
    }, 60_000);
  },
);
