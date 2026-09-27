import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified: boolean } },
  membershipContext: vi.fn(),
  ownerContext: vi.fn(),
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  transitionCampaign: vi.fn(),
  previewAudience: vi.fn(),
  loadCampaignResults: vi.fn(),
  listTemplates: vi.fn(),
  enableTemplate: vi.fn(),
  disableTemplate: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

/**
 * Spec 0086 — **se doblan LOS DOS resolvedores, y la asimetria es la decision de esa spec**:
 * lo IRREVERSIBLE (`ownerOnly` de `HANDLERS`) conserva `requireApiOwner` (→ `ownerContext`,
 * `403 not_owner`); lo delegable pasa por `requireApiPermission` (→ `membershipContext`,
 * `403 missing_permission`). Un doble solo dejaria al otro resolvedor apuntando a la base.
 */
vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  membershipContext: world.membershipContext,
  ownerContext: world.ownerContext,
}));

// Only the domain entry points are replaced. `CampaignError` stays REAL: `_auth.ts` maps
// it to the HTTP status through an `instanceof`, and a fake class would make that
// `instanceof` false — the test would then be pinning the fake instead of the mapping.
vi.mock("./marketing/campaign-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/campaign-store")>()),
  listCampaigns: world.listCampaigns,
  createCampaign: world.createCampaign,
  getCampaign: world.getCampaign,
  updateCampaign: world.updateCampaign,
}));

vi.mock("./marketing/campaign-actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/campaign-actions")>()),
  transitionCampaign: world.transitionCampaign,
}));

// `parseAudiencePreviewQuery` stays REAL: it is the route's 400 `validation`, and a fake
// would mean the query string is never actually parsed by anything this test runs.
vi.mock("./marketing/audience-preview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/audience-preview")>()),
  previewAudience: world.previewAudience,
}));

vi.mock("./marketing/results-store", () => ({
  loadCampaignResults: world.loadCampaignResults,
}));

// Spec 0101: the three template routes. Only the store is replaced; the routes' guards
// and `campaignError` mapping stay real.
vi.mock("./marketing/template-store", () => ({
  listTemplates: world.listTemplates,
  enableTemplate: world.enableTemplate,
  disableTemplate: world.disableTemplate,
}));

import { POST } from "../app/api/marketing/campaigns/route";
import { POST as ACTIVATE } from "../app/api/marketing/campaigns/[id]/activate/route";
import { CampaignError } from "./marketing/campaign-store";
import { MARKETING_ROUTE_NAMES } from "./marketing-route-names";
import {
  CALLER_BUSINESS,
  CAMPAIGN,
  FIELDS,
  FOREIGN_BUSINESS,
  FOREIGN_CAMPAIGN,
  OWNER_ROW,
  base,
  marketingHandlers,
  one,
  params,
  request,
  signedInOwner as signIn,
} from "./marketing-routes-support";

const HANDLERS = marketingHandlers(world);
const signedInOwner = () => signIn(world);

/**
 * Spec 0065, DoD [B] isolation — «staff cannot create or activate a campaign → 403»,
 * pinned at the HTTP layer. The two `marketing-*.neon…` suites exercise the STORE, which
 * is already business-scoped — but that scoping only ever runs with the business the
 * ROUTE hands it. If a handler dropped its guard every one of those tests would stay
 * green while the endpoint answered to anybody: spec 0046's locked door beside an open
 * wall.
 */
describe("api/marketing — owner-only guard (spec 0065, DoD [B])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.session = null;
    world.listCampaigns.mockResolvedValue([]);
    world.createCampaign.mockResolvedValue(CAMPAIGN);
    world.getCampaign.mockResolvedValue(CAMPAIGN);
    world.updateCampaign.mockResolvedValue(CAMPAIGN);
    world.transitionCampaign.mockResolvedValue({ campaign: CAMPAIGN });
    world.previewAudience.mockResolvedValue({ quality: "observada" });
    world.loadCampaignResults.mockResolvedValue({ turns: {} });
    world.listTemplates.mockResolvedValue([]);
    world.enableTemplate.mockResolvedValue(CAMPAIGN);
    world.disableTemplate.mockResolvedValue({ campaign: CAMPAIGN });
  });

  it.each(HANDLERS)(
    "$name answers 401 to an anonymous caller and never reaches the domain",
    async ({ call, spy }) => {
      world.session = null;
      const response = await call();
      expect(response.status).toBe(401);
      expect(spy).not.toHaveBeenCalled();
      expect(world.membershipContext).not.toHaveBeenCalled();
    },
  );

  it.each(HANDLERS)(
    "$name answers 403 to a signed-in caller who is not an owner",
    async ({ call, spy }) => {
      // Spec 0086: `membershipContext` returns null for a disabled member and for a
      // user with no membership: the three ways this endpoint must say no.
      world.session = { user: { id: "user-staff", emailVerified: true } };
      world.membershipContext.mockResolvedValue(null);
      world.ownerContext.mockResolvedValue(null);
      const response = await call();
      expect(response.status).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  /**
   * Spec 0086 §3 / ADR 0079 §2 — **LO IRREVERSIBLE NO SE DELEGA, y acá se ve cuál es cuál.**
   * Un integrante con el permiso `marketing` completo entra a las entradas delegables y
   * recibe `403 not_owner` en `archive`, `end` y `templates/:key/disable`, que no se
   * deshacen (`ownerOnly` de `HANDLERS`).
   *
   * El control positivo va en el MISMO vector: sin él, un guard roto que contestara 403 a
   * todo pasaría este caso sin distinguir «acotado» de «muerto».
   */
  it.each(HANDLERS)(
    "$name: un STAFF con el permiso `marketing` entra, salvo en lo irreversible",
    async ({ call, spy, ownerOnly }) => {
      world.session = { user: { id: "user-staff", emailVerified: false } };
      world.membershipContext.mockResolvedValue({
        ...OWNER_ROW,
        role: "staff",
        permissions: ["marketing"],
      });
      // `ownerContext` filtra `role='owner'`: para un integrante devuelve null, que es
      // exactamente lo que hace a `archive` y `end` owner-only.
      world.ownerContext.mockResolvedValue(null);
      const response = await call();
      if (ownerOnly) {
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("not_owner");
        expect(spy).not.toHaveBeenCalled();
      } else {
        expect(response.status).toBeLessThan(400);
        expect(spy).toHaveBeenCalledTimes(1);
      }
    },
  );

  /** El otro lado del mismo eje: sin el toggle, ninguna de las ocho abre — y el `code` es
   * `missing_permission`, no `not_owner` (cambio de contrato de la 0086). */
  it.each(HANDLERS)(
    "$name: un STAFF SIN el permiso `marketing` → 403 `missing_permission`",
    async ({ call, spy, ownerOnly }) => {
      world.session = { user: { id: "user-staff", emailVerified: false } };
      world.membershipContext.mockResolvedValue({
        ...OWNER_ROW,
        role: "staff",
        permissions: ["catalog"],
      });
      world.ownerContext.mockResolvedValue(null);
      const response = await call();
      expect(response.status).toBe(403);
      // `archive`/`end` cortan antes, en el paso 2 de `requireApiOwner`, y ese `code` sigue
      // siendo `not_owner` a proposito: ahi es literalmente lo que pasa.
      expect((await response.json()).code).toBe(
        ownerOnly ? "not_owner" : "missing_permission",
      );
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each(HANDLERS)(
    "$name acts on the CALLER's business, never on one named by the request",
    async ({ call, spy, ownerOnly }) => {
      signedInOwner();
      const response = await call();
      expect(response.status).toBeLessThan(400);
      expect(spy).toHaveBeenCalledTimes(1);
      const business = (spy.mock.calls[0] as unknown[])[0];
      expect(business).toBe(CALLER_BUSINESS);
      expect(business).not.toBe(FOREIGN_BUSINESS);
      // …y la sesion de la que lo resolvio es la del caller, no una del header. Cual de los
      // dos resolvedores corrio depende de si la accion es irreversible (spec 0086 §3).
      const resolvedor = ownerOnly
        ? world.ownerContext
        : world.membershipContext;
      expect(resolvedor).toHaveBeenCalledWith("user-owner");
    },
  );

  it.each(HANDLERS.filter((h) => h.action !== null))(
    "$name asks the domain for ITS OWN action",
    async ({ call, action }) => {
      // The four action routes are one factory with a different argument, so a
      // copy-paste that leaves `pause` calling `end` typechecks and looks right.
      signedInOwner();
      await call();
      expect(world.transitionCampaign).toHaveBeenCalledWith(
        CALLER_BUSINESS,
        FOREIGN_CAMPAIGN,
        action,
      );
    },
  );
});

describe("api/marketing — how the domain's error becomes an answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInOwner();
    world.transitionCampaign.mockResolvedValue({ campaign: CAMPAIGN });
  });

  it.each([
    { status: 402, code: "plan_not_allowed" },
    { status: 404, code: "not_found" },
    { status: 409, code: "invalid_transition" },
  ])("a CampaignError $status keeps its status and its code", async (kind) => {
    world.transitionCampaign.mockRejectedValue(
      new CampaignError(kind.status, kind.code, "Mensaje del dominio."),
    );
    const response = await ACTIVATE(request(`${one}/activate`, "POST", {}), {
      params,
    });
    expect(response.status).toBe(kind.status);
    expect(await response.json()).toEqual({
      error: "Mensaje del dominio.",
      code: kind.code,
    });
  });

  it("a 400 validation carries `fields`, which is what paints the composer", async () => {
    world.createCampaign.mockRejectedValue(
      new CampaignError(400, "validation", "Revisá los datos.", {
        message: "Máximo 60 caracteres.",
      }),
    );
    const response = await POST(request(base, "POST", FIELDS));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Revisá los datos.",
      code: "validation",
      fields: { message: "Máximo 60 caracteres." },
    });
  });

  it("a body that is not JSON is a 400 `invalid_body` and never reaches the domain", async () => {
    const response = await POST(request(base, "POST", "{no-json"));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_body");
    expect(world.createCampaign).not.toHaveBeenCalled();
  });

  it("anything else is a 503 that says nothing about the failure", async () => {
    // The exact `toEqual` IS the assertion: a host or a stack here would leak to the browser.
    world.createCampaign.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:5432"),
    );
    const response = await POST(request(base, "POST", FIELDS));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "No pudimos crear la campaña.",
    });
  });

  // The other half of this check lives in `marketing-routes-coverage.test.ts`, which
  // derives the same names from the FILESYSTEM. Together: a route that exists is
  // declared, and a route that is declared has its guard exercised above.
  it("HANDLERS covers exactly the declared routes, no more and no less", () => {
    expect([...new Set(HANDLERS.map((h) => h.name))].sort()).toEqual(
      [...MARKETING_ROUTE_NAMES].sort(),
    );
  });
});
