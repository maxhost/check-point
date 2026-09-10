import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { dropBusiness } from "./counter-integration-support";
import {
  integrationEnabled,
  seedExtraLocation,
  seedLocationsBusiness,
} from "./locations-integration-support";
import { getDb } from "./db";
import { locations } from "./schema";

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
    membership: { role: string; status: string };
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
        membership: { role: "owner", status: "active" },
      };
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(businessId);
    }, 60_000);

    it("the counter page hands down ONLY the active locations", async () => {
      const element = (await CounterPage({
        searchParams: Promise.resolve({}),
      })) as { props: { locations: { id: string; name: string }[] } };

      const ids = element.props.locations.map((l) => l.id);
      // Anti-false-green: the active one IS there, so an empty/short list is the status
      // filter and not a broken query or an empty seed.
      expect(ids).toContain(activeId);
      expect(ids).not.toContain(archivedId);
      expect(ids).toHaveLength(1);
    }, 60_000);

    it("an archived `?location=` is not preselected, because it is not in the list", async () => {
      const element = (await CounterPage({
        searchParams: Promise.resolve({ location: archivedId }),
      })) as {
        props: {
          locations: { id: string }[];
          preselectedLocationId?: string;
        };
      };
      // The page passes the raw query param through; what makes it harmless is that the
      // console only honours a preselect present in `locations` (pinned by
      // `locations-counter-surface.test.ts`) and that `assertLocationInBusiness` refuses
      // it server-side anyway (pinned by `locations-counter-guard.neon.integration.test.ts`).
      expect(element.props.preselectedLocationId).toBe(archivedId);
      expect(element.props.locations.map((l) => l.id)).not.toContain(
        archivedId,
      );
    }, 60_000);

    it("the «Locales» tile points at the real screen, not at the spec 0015 mock", async () => {
      const html = renderToStaticMarkup(await BackofficePage());
      expect(html).toContain('href="/backoffice/locations"');
      expect(html).not.toContain("/backoffice/demo/locations");
      // The tiles with no real screen yet still fall back to the mock — this asserts the
      // re-route was surgical and did not silently break the others.
      expect(html).toContain("/backoffice/demo/campaigns");
      expect(html).toContain("/backoffice/demo/analytics");
      expect(html).toContain('href="/backoffice/staff"');
    }, 60_000);
  },
);
