import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import {
  campaignWorld,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import { permissionsForRole } from "@mi-pasaporte/db/permissions-catalog";

/** The session the page under test runs with; `requireOwner` itself (ADR 0044) has its
 * own tests and is not re-tested here. */
const ctx = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
}));

vi.mock("./auth-guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth-guards")>();
  return {
    ...actual,
    requireBackofficeSession: async () => ctx.session,
    requireOwner: async () => ctx.session,
  };
});

import BackofficePage from "../app/backoffice/page";

/**
 * Spec 0065 B3 — the backoffice home against the real branch: the «Campañas» tile points at
 * `/backoffice/marketing` and no longer at the spec 0015 mock.
 *
 * Spec 0131: the SSR cases of the three marketing pages were deleted (ADR 0070 §17). Since
 * `f61b163` those pages are shells over client components that read through the API, and
 * their invariants live there: isolation in `marketing-campaigns.neon.integration.test.ts`
 * and `marketing-results.neon.integration.test.ts`, no `*ObjectKey` in `catalog.test.ts`. The
 * pages' own permission guard is `app/backoffice/marketing/page-guard.test.ts`.
 */

function sessionFor(seed: { userId: string; business: { id: string } }) {
  return {
    userId: seed.userId,
    userName: "Ana",
    business: {
      id: seed.business.id,
      name: "Campañas",
      currencyCode: "USD",
      timezone: "America/Guayaquil",
    },
    // The shape production builds (`auth-guards.ts`, via `permissionsForRole`): an owner
    // session always carries its permissions. Omitting them described an impossible session.
    membership: {
      role: "owner",
      status: "active",
      permissions: permissionsForRole("owner", []),
    },
  };
}

afterAll(dropCampaignWorlds, 120_000);

describe.skipIf(!integrationEnabled)("marketing backoffice pages", () => {
  it("the «Campañas» tile goes to the real screen, not to the spec 0015 mock", async () => {
    const seed = await campaignWorld("plus", "Tile");
    ctx.session = sessionFor(seed);

    const html = renderToStaticMarkup(await BackofficePage());

    expect(html).toContain('href="/backoffice/marketing"');
    expect(html).not.toContain("/backoffice/demo/campaigns");
    // Anti-false-green: the re-route was surgical. The spec 0015 mock is gone entirely
    // (`analytics` had no real screen and its tile was removed, not migrated), and the
    // other real sections did not move.
    expect(html).not.toContain("/backoffice/demo/");
    expect(html).toContain('href="/backoffice/locations"');
  }, 120_000);
});
