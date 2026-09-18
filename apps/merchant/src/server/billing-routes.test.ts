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
 * Spec 0063, D6 — LA CAPA HTTP de las 5 rutas de billing, con el dominio doblado. Calcado de
 * `locations-routes.test.ts`, incluido el motivo: el dominio ya está scopeado por negocio, pero
 * ese scope SÓLO corre con el negocio que le pasa la RUTA — si un handler perdiera su gate,
 * todo el dominio seguiría verde mientras el endpoint le contesta a cualquiera (spec 0046: una
 * puerta con candado al lado de una pared abierta). Lo que este archivo NO PUEDE VER, y por eso
 * existe `billing-routes-auth.neon.integration.test.ts`: con `ownerContext` doblado, un staff
 * ACTIVO y uno DESACTIVADO son el mismo `null`.
 */
const world = vi.hoisted(() => ({
  /**
   * Spec 0072: `emailVerified` entra al doble de la sesión porque `requireApiOwner` —el
   * resolvedor único de las 10 superficies del owner— ahora corre el gate de email también
   * acá. Es una edición del FIXTURE, no de una aserción: cada `it` sigue aseverando lo
   * mismo que aseveraba.
   */
  session: null as null | { user: { id: string; emailVerified: boolean } },
  ownerContext: vi.fn(),
  readSubscription: vi.fn(),
  activeLocationCount: vi.fn(),
  activeCampaignCount: vi.fn(),
  lockBusiness: vi.fn(),
  scheduleDowngrade: vi.fn(),
  clearPendingPlan: vi.fn(),
  settleToFree: vi.fn(),
}));

let fake: FakeStripe = fakeStripe();

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: world.ownerContext,
}));

/** El `tx` no se usa de verdad —el store va doblado— salvo por la escritura del
 * `stripe_customer_id` del checkout, que arma un builder de drizzle sobre él. */
vi.mock("./db", async (importOriginal) => {
  const chain = {
    set: () => chain,
    where: async () => undefined,
  } as unknown as Record<string, unknown>;
  return {
    ...(await importOriginal<typeof import("./db")>()),
    withDbTransaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({ update: () => chain }),
  };
});

vi.mock("./locations/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./locations/shared")>()),
  lockBusiness: world.lockBusiness,
  activeLocationCount: world.activeLocationCount,
}));

// Spec 0065, fase D: el `tx` de acá sólo sabe hacer `update` (ver el doble de `./db`), así
// que el conteo de campañas va doblado por el mismo motivo que el de locales. Sin esto las
// 4 rutas contestaban 503 — y el 503 se leía como «la ruta se rompió», no como «el doble no
// sabe contar».
vi.mock("./marketing/plan-brake", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/plan-brake")>()),
  activeCampaignCount: world.activeCampaignCount,
}));

// `decidePlanChange` y `toSubscriptionView` quedan REALES: son la decisión que la ruta tiene
// que respetar, y doblarlas sería testear el doble.
vi.mock("./billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./billing")>()),
  readSubscription: world.readSubscription,
  scheduleDowngrade: world.scheduleDowngrade,
  clearPendingPlan: world.clearPendingPlan,
  settleToFree: world.settleToFree,
}));

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as INTERVAL } from "../app/api/billing/interval/route";
import { POST as SETTLE_FREE } from "../app/api/billing/settle-free/route";
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
 * Las 5 rutas, cada una con el estado de fila que la deja LLEGAR al dominio. Toda llamada
 * grita un negocio AJENO en el query string Y en el body: el punto es que ninguno de los dos
 * pueda torcer el handler.
 *
 * `GET /api/billing/state` (spec 0074 §D2) entra a la MISMA lista y no a un bloque propio: es
 * una superficie del owner como las otras cuatro, pasa por el mismo `requireBillingOwner` y
 * tiene que emitir los mismos `code`. Un `GET` no lleva cuerpo, así que su negocio ajeno lo
 * grita sólo el query string — ver {@link call}.
 */
const HANDLERS = [
  ["POST", "checkout", CHECKOUT, { interval: "month" }, row()],
  ["POST", "cancel", CANCEL, {}, LIVE_ROW],
  ["POST", "interval", INTERVAL, { to: "year" }, LIVE_ROW],
  ["POST", "settle-free", SETTLE_FREE, {}, row({ plan: "none" })],
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
    // Spec 0072: `ownerContext` selecciona el eje `status`, y el guard es fail-closed —
    // una fila sin `status` NO opera. Es la forma que devuelve la función real.
    status: "active",
    suspensionReason: null,
  });
  world.readSubscription.mockResolvedValue(seeded);
  world.activeLocationCount.mockResolvedValue(activeLocations);
  world.activeCampaignCount.mockResolvedValue(0);
}

describe("api/billing — owner-only guard (spec 0063, D6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.session = null;
    world.activeLocationCount.mockResolvedValue(1);
    world.activeCampaignCount.mockResolvedValue(0);
    world.lockBusiness.mockResolvedValue({ id: CALLER_BUSINESS });
    world.scheduleDowngrade.mockResolvedValue({
      downgradeRequestedAt: new Date(Date.UTC(2026, 8, 11)),
    });
    world.clearPendingPlan.mockResolvedValue(undefined);
    world.settleToFree.mockResolvedValue(undefined);
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
      // El `code` es NUEVO y es la decisión del owner del 2026-09-17 que la spec 0072 §D3
      // implementa («si a los `code`»): los 401/403 de las 10 superficies del owner los
      // llevan normalizados. Ésta es la ÚNICA aserción preexistente que esta spec cambia,
      // y cambia porque el contrato cambió — el status sigue siendo 403 y el `error` sigue
      // siendo la copia de billing.
      expect(await response.json()).toEqual({
        error: "Solo el owner puede gestionar la suscripción.",
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

  /** LA FORMA DEL FALLO del contrato de D6: `{ error, code }` exacto, sin nada más. El
   * `archiveCount` de `downgrade_blocked` lo pinnea la integración, con 3 locales de verdad. */
  it("sin `MERCHANT_PUBLIC_ORIGIN`, `checkout` responde 503 `origin_not_configured` y NO cae al request.url", async () => {
    signedInOwner(row());
    vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "");
    const response = await CHECKOUT(request("checkout", { interval: "month" }));
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
    // `readBody` tolera la AUSENCIA de body (decisión 7): sin el `try`, `request.json()` tira
    // y la ruta contesta 503. El oráculo TIENE que ser una ruta que llame a `readBody`: con
    // `cancel` —que no lee el body— este caso queda verde con y sin el guard (verificado).
    const sinBody = await INTERVAL(
      new NextRequest("https://merchant.test/api/billing/interval", {
        method: "POST",
      }),
    );
    expect(sinBody.status).toBe(400);
  });
});

/**
 * Tarea 52 — `HANDLERS` está escrita a mano, así que una 5.ª ruta bajo `api/billing/**`
 * nacería SIN gate con este archivo en verde (la lección de la spec 0046 y la del barrido de
 * MIME). Este bloque deriva `MÉTODO /ruta` del FILESYSTEM y exige que sea igual al cubierto.
 *
 * PROXY, y etiquetado como tal: pinnea que cada handler esté LISTADO, no que su gate sea
 * correcto — eso lo hacen los `it.each`. Se leen LAS DOS ortografías de un handler de Next
 * (`export async function POST` y `export const POST =`), que acá no es teórico:
 * `settle-free/route.ts` usa la segunda. Y se asevera un piso de archivos para que un barrido
 * que no ve nada no pueda pasar en verde.
 */
describe("every handler under api/billing/** is covered by HANDLERS", () => {
  it("the filesystem and the list agree exactly", () => {
    const root = join(import.meta.dirname, "../app/api/billing");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((f) => basename(f) === "route.ts")
      .sort();
    // PISO, para que un barrido que no ve nada no pueda quedar verde. Bajó de 5 a 4 porque
    // `resume` dejó de existir (spec 0064 §4), no para tapar un barrido roto: el `toEqual` de
    // abajo sigue exigiendo igualdad EXACTA entre el filesystem y la lista. Vuelve a 5 con
    // `state` (spec 0074 §D2) — un piso SUBE cuando llega una ruta, nunca baja para que pase.
    expect(files.length).toBeGreaterThanOrEqual(5);

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
