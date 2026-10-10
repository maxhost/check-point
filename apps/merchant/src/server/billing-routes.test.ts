import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CALLER_BUSINESS,
  FOREIGN_BUSINESS,
  LIVE_ROW,
  STRIPE_TEST_ENV,
  subscriptionRowFixture as row,
} from "./billing-integration-support";
import {
  fakeStripe,
  stripeSubscription,
  type FakeStripe,
} from "./billing-stripe-fake";
import type { SubscriptionRow } from "./billing";

const MONTHLY = STRIPE_TEST_ENV.STRIPE_PRICE_PLUS_MONTHLY_TEST;

/**
 * Spec 0063 D6 + spec 0189 §D7 — LA CAPA HTTP de las rutas de billing, con el dominio doblado.
 * Calcado de `locations-routes.test.ts`, incluido el motivo: el dominio está scopeado por
 * negocio, pero ese scope SÓLO corre con el negocio que le pasa la RUTA. Lo que este archivo NO
 * PUEDE VER (staff activo vs desactivado: con `ownerContext` doblado son el mismo `null`) lo ve
 * `billing-routes-auth.neon.integration.test.ts`.
 */
const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified: boolean } },
  ownerContext: vi.fn(),
  readSubscription: vi.fn(),
  activeLocationCount: vi.fn(),
  activeCampaignsOutsideBase: vi.fn(),
  lockBusiness: vi.fn(),
  scheduleCancel: vi.fn(),
  clearPendingPlan: vi.fn(),
}));

let fake: FakeStripe = fakeStripe();

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: world.ownerContext,
}));

/** El `tx` sólo lo usa la escritura del `stripe_customer_id` del checkout. */
vi.mock("@mi-pasaporte/db", async (importOriginal) => {
  const chain = {
    set: () => chain,
    where: async () => undefined,
  } as unknown as Record<string, unknown>;
  return {
    ...(await importOriginal<typeof import("@mi-pasaporte/db")>()),
    withDbTransaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({ update: () => chain }),
  };
});

vi.mock("./locations/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./locations/shared")>()),
  lockBusiness: world.lockBusiness,
  activeLocationCount: world.activeLocationCount,
}));

// El `tx` sólo sabe hacer `update`: el conteo de campañas va doblado como el de locales.
vi.mock("./marketing/plan-brake", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/plan-brake")>()),
  activeCampaignsOutsideBase: world.activeCampaignsOutsideBase,
}));

// `decidePlanChange` y `toSubscriptionView` quedan REALES: doblarlas sería testear el doble.
vi.mock("./billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./billing")>()),
  readSubscription: world.readSubscription,
  scheduleCancel: world.scheduleCancel,
  clearPendingPlan: world.clearPendingPlan,
}));

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as INTERVAL } from "../app/api/billing/interval/route";
import { POST as PLAN } from "../app/api/billing/plan/route";
import { POST as RESUME } from "../app/api/billing/resume/route";
import { GET as STATE } from "../app/api/billing/state/route";

const request = (path: string, body?: unknown) =>
  new NextRequest(
    `https://merchant.test/api/billing/${path}?b=${FOREIGN_BUSINESS}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );

/**
 * Las rutas, cada una con el estado de fila que la deja LLEGAR al dominio. Toda llamada grita
 * un negocio AJENO en el query string Y en el body: ninguno de los dos puede torcer el handler.
 * Un `GET` no lleva cuerpo: su negocio ajeno lo grita sólo el query string ({@link call}).
 */
const HANDLERS = [
  ["POST", "checkout", CHECKOUT, { plan: "base", interval: "month" }, row()],
  ["POST", "cancel", CANCEL, {}, LIVE_ROW],
  ["POST", "interval", INTERVAL, { to: "year" }, LIVE_ROW],
  ["POST", "plan", PLAN, { to: "base" }, LIVE_ROW],
  ["POST", "resume", RESUME, {}, { ...LIVE_ROW, pendingPlan: "none" }],
  ["GET", "state", STATE, {}, LIVE_ROW],
].map(([method, path, handler, body, seeded]) => ({
  name: `${method as string} /api/billing/${path as string}`,
  method: method as string,
  path: path as string,
  handler: handler as (r: NextRequest) => Promise<Response>,
  body: body as Record<string, unknown>,
  row: seeded as SubscriptionRow,
}));

type Handler = (typeof HANDLERS)[number];

const call = (h: Handler) =>
  h.method === "GET"
    ? h.handler(
        new NextRequest(
          `https://merchant.test/api/billing/${h.path}?b=${FOREIGN_BUSINESS}`,
          { method: "GET" },
        ),
      )
    : h.handler(request(h.path, { ...h.body, businessId: FOREIGN_BUSINESS }));

/** Un owner ACTIVO con la fila y el conteo pedidos. */
function signedInOwner(seeded: SubscriptionRow, activeLocations = 1) {
  world.session = { user: { id: "user-owner", emailVerified: true } };
  world.ownerContext.mockResolvedValue({
    id: CALLER_BUSINESS,
    slug: "caller",
    currencyCode: "USD",
    status: "active", // fail-closed: una fila sin `status` NO opera (spec 0072)
    suspensionReason: null,
  });
  world.readSubscription.mockResolvedValue(seeded);
  world.activeLocationCount.mockResolvedValue(activeLocations);
  world.activeCampaignsOutsideBase.mockResolvedValue(0);
}

describe("api/billing — owner-only guard (spec 0063, D6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.session = null;
    world.activeLocationCount.mockResolvedValue(1);
    world.activeCampaignsOutsideBase.mockResolvedValue(0);
    world.lockBusiness.mockResolvedValue({ id: CALLER_BUSINESS });
    world.scheduleCancel.mockResolvedValue(undefined);
    world.clearPendingPlan.mockResolvedValue(undefined);
    fake = fakeStripe();
    fake.subscriptions.set(
      "sub_caller",
      stripeSubscription({ id: "sub_caller", items: [{ priceId: MONTHLY }] }),
    );
    for (const [name, value] of Object.entries(STRIPE_TEST_ENV)) {
      vi.stubEnv(name, value);
    }
    vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://checkpass.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(HANDLERS)(
    "$name answers 401 to an anonymous caller and never reaches the domain",
    async (h) => {
      world.session = null;
      const response = await call(h);
      expect(response.status).toBe(401);
      expect(world.readSubscription).not.toHaveBeenCalled();
      expect(world.ownerContext).not.toHaveBeenCalled();
    },
  );

  it.each(HANDLERS)(
    "$name answers 403 to a signed-in caller who is not an active owner",
    async (h) => {
      world.session = { user: { id: "user-staff", emailVerified: true } };
      world.ownerContext.mockResolvedValue(null);
      const response = await call(h);
      expect(response.status).toBe(403);
      // Spec 0072 §D3: los 401/403 de las superficies del owner llevan `code` normalizado.
      expect(await response.json()).toEqual({
        error: "Solo la persona propietaria puede gestionar la suscripción.",
        code: "not_owner",
      });
      expect(world.readSubscription).not.toHaveBeenCalled();
    },
  );

  it.each(HANDLERS)(
    "$name acts on the CALLER's business, never on one named by the request",
    async (h) => {
      signedInOwner(h.row);
      const response = await call(h);
      expect(response.status).toBeLessThan(400);
      expect(world.readSubscription).toHaveBeenCalled();
      // Ni una sola de las lecturas puede haber usado el negocio del body/query.
      for (const args of world.readSubscription.mock.calls) {
        expect(args[1]).toBe(CALLER_BUSINESS);
        expect(args[1]).not.toBe(FOREIGN_BUSINESS);
      }
      expect(world.ownerContext).toHaveBeenCalledWith("user-owner");
    },
  );

  /** LA FORMA DEL FALLO: `{ error, code }` exacto, sin nada más. */
  it("sin `MERCHANT_PUBLIC_ORIGIN`, `checkout` responde 503 `origin_not_configured` y NO cae al request.url", async () => {
    signedInOwner(row());
    vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "");
    const response = await CHECKOUT(
      request("checkout", { plan: "plus", interval: "month" }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "El pago no está configurado todavía. Escríbenos y lo resolvemos.",
      code: "origin_not_configured",
    });
    // Y no abrió ninguna sesión con el origen del request.
    expect(fake.calls).toEqual([]);
  });

  it("el parseo del body: `interval` sin `to` es 400, y SIN body también", async () => {
    signedInOwner(LIVE_ROW);
    const invalido = await INTERVAL(request("interval", {}));
    expect(invalido.status).toBe(400);
    expect(await invalido.json()).toMatchObject({ code: "invalid_input" });
    // `readBody` tolera la AUSENCIA de body: sin el `try` la ruta contesta 503. Tiene que ser
    // una ruta que llame a `readBody` (`cancel` no lo lee: quedaría verde con y sin el guard).
    const sinBody = await INTERVAL(
      new NextRequest("https://merchant.test/api/billing/interval", {
        method: "POST",
      }),
    );
    expect(sinBody.status).toBe(400);
    // Spec 0189 §D7: el checkout exige `plan` (base|plus); con solo `interval`, 400.
    signedInOwner(row());
    const sinPlan = await CHECKOUT(request("checkout", { interval: "month" }));
    expect([sinPlan.status, fake.calls]).toEqual([400, []]);
  });
});

/**
 * Tarea 52 — `HANDLERS` está escrita a mano, así que una ruta nueva bajo `api/billing/**`
 * nacería SIN gate con este archivo en verde. Este bloque deriva `MÉTODO /ruta` del FILESYSTEM
 * y exige que sea igual al cubierto. PROXY, y etiquetado como tal: pinnea que cada handler esté
 * LISTADO, no que su gate sea correcto. Lee las DOS ortografías de un handler de Next
 * (`export async function POST` y `export const POST =`) y asevera un piso de archivos.
 */
describe("every handler under api/billing/** is covered by HANDLERS", () => {
  it("the filesystem and the list agree exactly", () => {
    const root = join(import.meta.dirname, "../app/api/billing");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((f) => basename(f) === "route.ts")
      .sort();
    // PISO: un barrido que no ve nada no puede quedar verde. Sube a 6 con la spec 0189
    // (`settle-free` se fue; `plan` y `resume` llegaron): un piso SUBE con las rutas.
    expect(files.length).toBeGreaterThanOrEqual(6);

    const expected = new Set<string>();
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      const url = ["/api/billing", ...dirname(file).split(sep)]
        .filter((s) => s && s !== ".")
        .map((s) => s.replace(/^\[(.+)\]$/, ":$1"))
        .join("/");
      const methods = new Set<string>();
      for (const m of source.matchAll(
        /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
      ))
        methods.add(m[1]);
      for (const m of source.matchAll(
        /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g,
      ))
        methods.add(m[1]);
      expect(methods.size, `${file} exports no HTTP handler`).toBeGreaterThan(
        0,
      );
      for (const method of methods) expected.add(`${method} ${url}`);
    }

    const covered = new Set(HANDLERS.map((h) => h.name));
    expect([...covered].sort()).toEqual([...expected].sort());
  });
});
