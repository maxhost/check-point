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
const CALLER_BUSINESS = "11111111-1111-4111-8111-111111111111";

const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified?: boolean } },
  ownerRow: null as null | Record<string, unknown>,
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: async () => world.ownerRow,
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

function ownerRow(status: string, suspensionReason: string | null = null) {
  return {
    id: CALLER_BUSINESS,
    slug: "la-farmacia",
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

  it.each(SURFACES)(
    "%s: owner con `emailVerified: false` → 403 `email_not_verified`",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: false } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
    },
  );

  it.each(SURFACES)(
    "%s: owner SIN la clave `emailVerified` → 403 igual (fail-closed)",
    async (_name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = ownerRow("active");
      const response = await call();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
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
