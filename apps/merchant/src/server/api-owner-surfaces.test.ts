import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0072 §D3/§D4 — EL GATE DE LAS SUPERFICIES DE API DEL OWNER, las 10, en una matriz.
 *
 * Por qué acá y no repartido por dominio: el agujero que esta spec cierra es justamente que
 * **cada dominio tenía su propio resolvedor** y sólo uno chequeaba el email. Un test por
 * dominio reproduce esa estructura y no vería el día que uno se quede atrás; esta tabla sí,
 * porque agregar una ruta owner sin su fila acá es visible de un vistazo.
 *
 * Lo que NO prueba: el camino feliz de cada dominio (eso lo tienen sus propias suites) ni la
 * resolución real contra Postgres (eso es `ownerContext`, con su integración). Acá se dobla
 * la sesión y `ownerContext`, y se mide **qué status y qué `code`** sale de cada ruta en los
 * cinco estados del caller.
 */
const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified?: boolean } },
  ownerRow: null as null | Record<string, unknown>,
  /** El negocio y el programa del caller. Viven acá —y no en una `const` de módulo— porque
   * los factories de `vi.mock` se hoistean por encima de las declaraciones del archivo. */
  businessId: "11111111-1111-4111-8111-111111111111",
  programId: "99999999-9999-4999-8999-999999999999",
  slug: "la-farmacia",
}));

const CALLER_BUSINESS = world.businessId;

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: async () => world.ownerRow,
}));

/**
 * Spec 0075 — **el QR es la única fila que PASA el gate** en un caso, así que es la única que
 * llega a su dominio. Sus dos dependencias de datos se doblan para que ese 200 sea
 * **determinista**: sin esto daría 403 `not_owner` con `DATABASE_URL` puesta (el usuario
 * doblado no existe en la base) y 503 `qr_unavailable` sin ella, y **ninguno de los dos
 * probaría la polaridad**. El 200 contra la base lo prueba `loyalty-qr.neon.integration`.
 */
vi.mock("./loyalty-program", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./loyalty-program")>()),
  programForOwner: async () => ({
    business: { id: world.businessId },
    program: { id: world.programId },
    rewards: [],
  }),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ slug: world.slug }] }),
      }),
    }),
  }),
}));

import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { GET as CATALOG } from "../app/api/catalog/route";
import { GET as LOCATIONS } from "../app/api/locations/route";
import { GET as CAMPAIGNS } from "../app/api/marketing/campaigns/route";
import { GET as STAFF } from "../app/api/staff/route";
import { GET as BRAND } from "../app/api/brand/route";
import { POST as LOGO_UPLOAD } from "../app/api/brand/logo-upload/route";
import { GET as PROGRAM } from "../app/api/loyalty-program/route";
import { POST as STAMP_UPLOAD } from "../app/api/loyalty-program/stamp-upload/route";
import { GET as QR } from "../app/api/loyalty-program/qr/route";
import { GET as TEMPLATES } from "../app/api/loyalty-terms/templates/route";
import { PATCH as SLUG } from "../app/api/merchant/business/slug/route";

const json = (path: string, method: string) =>
  new NextRequest(`https://merchant.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify({}) }),
  });

/** Las 12 entradas HTTP de las 10 superficies del owner. `qr` y `slug` incluidas: la
 * primera nació con la spec 0069 (por eso la fila 56 de `PARQUEADO` decía 9 y eran 10). */
const SURFACES: Array<[string, () => Promise<Response>]> = [
  ["billing/checkout", () => CHECKOUT(json("/api/billing/checkout", "POST"))],
  ["catalog", () => CATALOG(json("/api/catalog", "GET"))],
  ["locations", () => LOCATIONS(json("/api/locations", "GET"))],
  [
    "marketing/campaigns",
    () => CAMPAIGNS(json("/api/marketing/campaigns", "GET")),
  ],
  ["staff", () => STAFF(json("/api/staff", "GET"))],
  ["brand", () => BRAND(json("/api/brand", "GET"))],
  [
    "brand/logo-upload",
    () => LOGO_UPLOAD(json("/api/brand/logo-upload", "POST")),
  ],
  ["loyalty-program", () => PROGRAM(json("/api/loyalty-program", "GET"))],
  [
    "loyalty-program/stamp-upload",
    () => STAMP_UPLOAD(json("/api/loyalty-program/stamp-upload", "POST")),
  ],
  ["loyalty-program/qr", () => QR(json("/api/loyalty-program/qr", "GET"))],
  [
    "loyalty-terms/templates",
    () => TEMPLATES(json("/api/loyalty-terms/templates", "GET")),
  ],
  [
    "merchant/business/slug",
    () => SLUG(json("/api/merchant/business/slug", "PATCH")),
  ],
];

/**
 * Spec 0075 — **el email es el único de los cuatro pasos que no se aplica parejo**, y la tabla
 * se parte para ASEVERAR la excepción en vez de perderla de vista. `SURFACES` sigue entera
 * (12) para los otros cinco casos: el QR se mide igual que las demás en `unauthorized`,
 * `not_owner`, `business_suspended`, `business_closed` y `status` desconocido. Las dos salen
 * de `SURFACES` por filtro —no son listas paralelas—, así que mover una fila cambia los pisos.
 */
const SURFACES_CON_GATE_DE_EMAIL = SURFACES.filter(
  ([name]) => name !== "loyalty-program/qr",
);

/** La única excepción del repo, y existe por el ADR 0070 §11: la pantalla del QR es la CUARTA
 * del wizard, y la verificación bloquea «todo lo que venga DESPUÉS del wizard». */
const SURFACES_SIN_GATE_DE_EMAIL = SURFACES.filter(
  ([name]) => name === "loyalty-program/qr",
);

function ownerRow(status: string, suspensionReason: string | null = null) {
  return {
    id: CALLER_BUSINESS,
    slug: world.slug,
    currencyCode: "USD",
    status,
    suspensionReason,
  };
}

beforeEach(() => {
  world.session = null;
  world.ownerRow = null;
});

describe("las superficies de API del owner — el gate unificado (spec 0072 §D3)", () => {
  it("son 12 entradas HTTP y ninguna se cayó de la tabla", () => {
    // Piso del barrido: sin esto, una tabla que quedara vacía dejaría cada `it.each` de
    // abajo sin correr NI UNA vez y el archivo entero pasaría en verde sin medir nada.
    expect(SURFACES.length).toBe(12);
  });

  it("las dos tablas del email parten las 12 sin perder ni duplicar ninguna", () => {
    // Spec 0075 §D3. Sin estos tres pisos, mover la fila del QR de una tabla a la otra —o
    // vaciar la de la excepción— dejaría su `it.each` sin correr NI UNA vez, en verde.
    expect(SURFACES_CON_GATE_DE_EMAIL.length).toBe(11);
    expect(SURFACES_SIN_GATE_DE_EMAIL.length).toBe(1);
    expect(
      SURFACES_CON_GATE_DE_EMAIL.length + SURFACES_SIN_GATE_DE_EMAIL.length,
    ).toBe(SURFACES.length);
    expect(SURFACES_SIN_GATE_DE_EMAIL[0][0]).toBe("loyalty-program/qr");
  });

  it.each(SURFACES)(
    "%s: sin sesión → 401 `unauthorized`",
    async (_name, call) => {
      const response = await call();
      expect(response.status).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    },
  );

  /**
   * EL ORDEN DE §D1, y es la mutación M3. El caller tiene el email SIN verificar **y** no es
   * owner: tiene que recibir `not_owner`, no `email_not_verified`. Puesto al revés, un
   * INTEGRANTE —cuyo email es sintético y no se verifica NUNCA— recibiría un código que le
   * pide hacer algo que no puede hacer, y un tercero podría sondear el estado de un negocio
   * ajeno. Ya lo cazó un test de la spec 0067 en `api/staff`; ahora vale para las 10.
   */
  it.each(SURFACES)(
    "%s: un INTEGRANTE (sin email verificado) → 403 `not_owner`, nunca `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-staff", emailVerified: false } };
      world.ownerRow = null;
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("not_owner");
    },
  );

  it.each(SURFACES_CON_GATE_DE_EMAIL)(
    "%s: owner con `emailVerified: false` → 403 `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: false } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
    },
  );

  it.each(SURFACES_CON_GATE_DE_EMAIL)(
    "%s: owner SIN la clave `emailVerified` → 403 igual (fail-closed)",
    async (_name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
    },
  );

  /**
   * LA EXCEPCIÓN, ASEVERADA EN POSITIVO (spec 0075 §D3). Un `not.toBe(403)` solo diría lo
   * mismo si la ruta se rompiera de cualquier otra forma: acá se exige el desenlace COMPLETO
   * del camino feliz —200 + `image/svg+xml` + un SVG de verdad— **y** que el `code` del gate
   * no aparezca en el cuerpo. Es el oráculo de la mutación M1.
   */
  it.each(SURFACES_SIN_GATE_DE_EMAIL)(
    "%s: owner con `emailVerified: false` sobre un negocio `active` → 200, NUNCA `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: false } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/svg+xml");
      const body = await response.text();
      expect(body).toContain("<svg");
      expect(body).not.toContain("email_not_verified");
    },
  );

  /** El doble del fail-closed: sin la clave `emailVerified` el paso 3 cierra en las otras 11
   * (test de arriba), y acá tampoco frena — porque el paso 3 no corre, no porque «pase». */
  it.each(SURFACES_SIN_GATE_DE_EMAIL)(
    "%s: owner SIN la clave `emailVerified` → 200 igual (el paso 3 no corre)",
    async (_name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/svg+xml");
      expect(await response.text()).not.toContain("email_not_verified");
    },
  );

  it.each(SURFACES)(
    "%s: negocio `suspended` → 403 `business_suspended` CON el motivo",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: true } };
      world.ownerRow = ownerRow("suspended", "Pago rechazado tres veces.");
      const response = await call();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("business_suspended");
      // El motivo se serializa SOLO al owner (§D4) y es lo que la pantalla de suspensión
      // necesita mostrar: sin él, el owner ve un 403 mudo y no sabe a qué reclamar.
      expect(body.suspensionReason).toBe("Pago rechazado tres veces.");
    },
  );

  it.each(SURFACES)(
    "%s: negocio `closed` → 403 `business_closed` y SIN motivo",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: true } };
      world.ownerRow = ownerRow(
        "closed",
        "Motivo viejo de una suspensión anterior.",
      );
      const response = await call();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("business_closed");
      expect(body.suspensionReason).toBeUndefined();
    },
  );

  /** Fail-CLOSED sobre un estado que nadie enseñó al guard. El `CHECK` de la columna hoy
   * sólo admite tres valores; el día que admita un cuarto, no se pasa de largo. */
  it.each(SURFACES)(
    "%s: un `status` desconocido no opera",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: true } };
      world.ownerRow = ownerRow("frozen");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("business_suspended");
    },
  );
});
