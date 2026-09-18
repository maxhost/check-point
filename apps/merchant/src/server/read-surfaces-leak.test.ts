import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscriptionRow } from "./billing";

/**
 * Spec 0074 §D0 — **CERO FUGA EN LAS TRES LECTURAS NUEVAS**, sobre el CONJUNTO EXACTO de
 * claves de cada respuesta.
 *
 * `CLAUDE.md`: una ruta que devuelve una entidad al navegador NUNCA serializa una clave
 * interna (`*ObjectKey` de R2, `stripeCustomerId`, `stripeSubscriptionId`,
 * `downgradeRequestedAt`). Un revisor independiente ya cazo esta clase de fuga en marca (spec
 * 0025) y en la 0068 una fuga sobrevivio a 1027 tests.
 *
 * **El oraculo es el conjunto EXACTO de caminos de clave, no un `not.toHaveProperty`**, que
 * pasa en verde el dia que el objeto cambia de forma (es el estilo de `expectCrossesExactly`,
 * `billing-pages-support.ts:143`). Las filas que el doble devuelve llevan las claves internas
 * PUESTAS y con valor: si una ruta devolviera la fila en vez del DTO, el conjunto no coincide
 * **y** el barrido de valores la ve.
 *
 * **Lo que este archivo NO prueba, y se declara:** que las rutas lean de la base lo que dicen
 * leer. El `getDb` va doblado, asi que la fila la escribe el propio test; eso lo cubren los
 * tres `.neon.integration.test.ts` de las tres rutas.
 */
const world = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; name: string; email: string; emailVerified: boolean };
  },
  /** Cola de resultados para cada `.limit()` del doble de drizzle, EN ORDEN. */
  rows: [] as Array<Array<Record<string, unknown>>>,
  ownerContext: vi.fn(),
  readSubscription: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./db", async (importOriginal) => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where", "orderBy"])
    chain[m] = () => chain;
  chain.limit = async () => world.rows.shift() ?? [];
  return {
    ...(await importOriginal<typeof import("./db")>()),
    getDb: () => chain,
    withDbTransaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work({}),
  };
});

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: world.ownerContext,
}));

// `toSubscriptionView` queda REAL: es la allow-list positiva que este archivo mide. Doblarla
// seria testear el doble.
vi.mock("./billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./billing")>()),
  readSubscription: world.readSubscription,
}));

vi.mock("./locations/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./locations/shared")>()),
  lockBusiness: async () => ({ id: CALLER }),
  activeLocationCount: async () => 2,
}));

vi.mock("./marketing/plan-brake", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/plan-brake")>()),
  activeCampaignCount: async () => 0,
}));

import { GET as SESSION } from "../app/api/merchant/session/route";
import { GET as BILLING_STATE } from "../app/api/billing/state/route";
import { GET as ONBOARDING_STATE } from "../app/api/onboarding/state/route";

const CALLER = "11111111-1111-4111-8111-111111111111";

/** Los valores que NO pueden cruzar. Son valores y no nombres de clave a proposito: un
 * renombre de campo no los esconde. */
const SECRETS = [
  "cus_leak",
  "sub_leak",
  "brand/leak/logo.png",
  "programs/leak/stamp",
];

/** La fila de suscripcion CON las tres columnas internas cargadas. */
const LEAKY_ROW: SubscriptionRow = {
  businessId: CALLER,
  plan: "plus",
  interval: "month",
  status: "active",
  stripeCustomerId: "cus_leak",
  stripeSubscriptionId: "sub_leak",
  pendingPlan: null,
  pendingPlanAt: null,
  downgradeRequestedAt: new Date(Date.UTC(2026, 8, 11)),
  lastEventAt: new Date(Date.UTC(2026, 8, 10)),
};

/** La fila del join `memberships × businesses`, con las columnas que la ruta NO proyecta. */
const BUSINESS_ROW = {
  id: CALLER,
  name: "Bar del barrio",
  slug: "bar-del-barrio",
  businessStatus: "suspended",
  suspensionReason: "Reclamos de consumidores.",
  currencyCode: "USD",
  timezone: "America/Guayaquil",
  role: "owner",
  membershipStatus: "active",
  logoObjectKey: "brand/leak/logo.png",
  brandRevision: 3,
};

const PROGRAM_ROW = {
  id: "33333333-3333-4333-8333-333333333333",
  kind: "stamps",
  stampImageObjectKey: "programs/leak/stamp",
  stampImageVersion: 4,
};

const request = (path: string) =>
  new Request(`https://merchant.test${path}`, { method: "GET" });

/** Todos los caminos de clave de un objeto, `a.b.c`. Un `null` es una HOJA: si una clave
 * desaparece o aparece, el conjunto cambia. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

type Surface = {
  name: string;
  keys: string[];
  run: () => Promise<Response>;
};

/**
 * LAS TRES RUTAS DE LECTURA DE LA 0074 EN CUATRO ESTADOS, cada uno el que MAS tiene para
 * filtrar: un negocio suspendido con logo, un `plus` vivo con cliente y suscripcion de
 * Stripe, un programa con imagen de sello subida, y una membresia DADA DE BAJA.
 *
 * El cuarto no es un duplicado del tercero: aca `business` y `program` tienen que ser HOJAS
 * `null`, asi que el conjunto exacto de claves es el oraculo de la regla de membresia de §D1
 * —que un integrante dado de baja no lee `id`/`name`/`slug` por esta puerta—. Sin el, borrar
 * el filtro de `route.ts` no ponia rojo nada en 1631 tests.
 */
const SURFACES: Surface[] = [
  {
    name: "GET /api/merchant/session",
    keys: [
      "authenticated",
      "user.id",
      "user.name",
      "user.email",
      "user.emailVerified",
      "business.id",
      "business.name",
      "business.slug",
      "business.status",
      "business.suspensionReason",
      "business.currencyCode",
      "business.timezone",
      "membership.role",
      "membership.status",
    ],
    run: () => {
      world.rows = [[BUSINESS_ROW]];
      return SESSION(request("/api/merchant/session"));
    },
  },
  {
    name: "GET /api/billing/state",
    keys: [
      "subscription.plan",
      "subscription.status",
      "subscription.interval",
      "subscription.pendingPlan",
      "subscription.pendingPlanAt",
      "activeLocations",
      "canCancel",
    ],
    run: () => {
      world.ownerContext.mockResolvedValue({
        id: CALLER,
        slug: "bar-del-barrio",
        currencyCode: "USD",
        status: "active",
        suspensionReason: null,
      });
      world.readSubscription.mockResolvedValue(LEAKY_ROW);
      return BILLING_STATE(request("/api/billing/state"));
    },
  },
  {
    name: "GET /api/onboarding/state",
    keys: [
      "authenticated",
      "business.id",
      "business.name",
      "business.slug",
      "program.id",
      "program.kind",
      "stampImage",
    ],
    run: () => {
      world.rows = [[BUSINESS_ROW], [PROGRAM_ROW]];
      return ONBOARDING_STATE(request("/api/onboarding/state"));
    },
  },
  {
    name: "GET /api/onboarding/state (membresia dada de baja)",
    // `business` y `program` son HOJAS `null`: si el filtro de membresia se cayera, el
    // conjunto se abriria a `business.id`/`business.name`/`business.slug` y esto da rojo.
    keys: ["authenticated", "business", "program", "stampImage"],
    run: () => {
      world.rows = [
        [{ ...BUSINESS_ROW, membershipStatus: "disabled" }],
        [PROGRAM_ROW],
      ];
      return ONBOARDING_STATE(request("/api/onboarding/state"));
    },
  },
];

describe("las tres lecturas de la spec 0074 no filtran una sola clave interna", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.rows = [];
    world.session = {
      user: {
        id: "user-owner",
        name: "Dueña",
        email: "duena@example.test",
        emailVerified: true,
      },
    };
  });

  /** PISO DE BARRIDO: sin esto, un `it.each` vacio pasaria en verde y el archivo entero
   * diria «no hay fuga» sin haber mirado una sola respuesta. Es lo que el revisor de la
   * 0072 verifico. **Un piso SUBE cuando llega un estado, nunca baja para que pase**: de 3
   * a 4 con la membresia dada de baja. */
  it("el barrido cubre los CUATRO estados de las tres rutas", () => {
    expect(SURFACES.length).toBe(4);
  });

  it.each(SURFACES)(
    "$name devuelve EXACTAMENTE las claves del contrato",
    async (surface) => {
      const response = await surface.run();
      expect(response.status, surface.name).toBe(200);
      const body = await response.json();
      expect(keyPaths(body).sort(), surface.name).toEqual(
        [...surface.keys].sort(),
      );
    },
  );

  it.each(SURFACES)(
    "$name no serializa NI UN valor interno",
    async (surface) => {
      const serialized = JSON.stringify(await (await surface.run()).json());
      for (const secret of SECRETS) {
        expect(serialized, `${surface.name} filtró ${secret}`).not.toContain(
          secret,
        );
      }
      // `downgradeRequestedAt` no tiene un valor de centinela propio —es una fecha— asi que
      // se asevera por el nombre de la clave ADEMAS del conjunto exacto de arriba.
      expect(serialized).not.toContain("downgradeRequested");
    },
  );
});
