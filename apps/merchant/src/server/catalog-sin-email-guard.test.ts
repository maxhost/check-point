import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0165 / ADR 0125 — **EL BARRIDO DE GUARD**: cada entrada HTTP que la 0165 saca del gate de
 * email, llamada con la sesion de un owner SIN verificar sobre un negocio `active`, pasa el
 * guard. Nunca `email_not_verified`, y tampoco ningun 401/403: un 403 de otro `code` diria que
 * el guard sigue frenando por otra puerta.
 *
 * Lo que NO mide: el desenlace del dominio. Despues del guard cada handler llega a su dominio
 * con `getDb` doblado y contesta lo que contesta (200, 4xx de validacion o un 503 de
 * infraestructura); el camino feliz contra la base vive en
 * `catalog-sin-email.neon.integration.test.ts` y `loyalty-program-sin-email.neon…`.
 *
 * Los dobles y el mundo son LOS MISMOS de `api-owner-surfaces-support.ts` (mismo motivo que
 * `api-permission-surfaces.test.ts`: dos baterias no pueden hablar de mundos distintos).
 */
import {
  dobleDeGetDb,
  dobleDeMembershipContext,
  dobleDeOwnerContext,
  dobleDeSesion,
  filaDeOwner,
  json,
  world,
} from "./api-owner-surfaces-support";
import { GET as CATALOG } from "../app/api/catalog/route";
import { POST as PRODUCT_POST } from "../app/api/catalog/product/route";
import {
  DELETE as PRODUCT_DELETE,
  PUT as PRODUCT_PUT,
} from "../app/api/catalog/product/[id]/route";
import { POST as IMAGE_UPLOAD } from "../app/api/catalog/product/image-upload/route";
import { POST as CATEGORY_POST } from "../app/api/catalog/category/route";
import {
  DELETE as CATEGORY_DELETE,
  PUT as CATEGORY_PUT,
} from "../app/api/catalog/category/[id]/route";
import { GET as STOCK_SEARCH } from "../app/api/catalog/stock/search/route";
import {
  GET as IMPORTS_GET,
  POST as IMPORTS_POST,
} from "../app/api/catalog/imports/route";
import {
  DELETE as IMPORT_DELETE,
  GET as IMPORT_GET,
} from "../app/api/catalog/imports/[id]/route";
import { POST as IMPORT_UPLOADS } from "../app/api/catalog/imports/[id]/uploads/route";
import { POST as IMPORT_ANALYZE } from "../app/api/catalog/imports/[id]/analyze/route";
import {
  DELETE as PROGRAM_DELETE,
  PATCH as PROGRAM_PATCH,
} from "../app/api/loyalty-program/route";

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: () => dobleDeSesion() } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: () => dobleDeOwnerContext(),
  membershipContext: () => dobleDeMembershipContext(),
}));

vi.mock("@mi-pasaporte/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mi-pasaporte/db")>()),
  getDb: () => dobleDeGetDb(),
}));

const ID = "22222222-2222-4222-8222-222222222222";
const conId = { params: Promise.resolve({ id: ID }) };

/** Las 17 entradas de las tablas de §Especificacion de la spec 0165. */
const ENTRADAS: Array<[string, () => Promise<Response>]> = [
  ["GET /api/catalog", () => CATALOG(json("/api/catalog", "GET"))],
  [
    "POST /api/catalog/product",
    () => PRODUCT_POST(json("/api/catalog/product", "POST", { name: "X" })),
  ],
  [
    "PUT /api/catalog/product/:id",
    () =>
      PRODUCT_PUT(
        json(`/api/catalog/product/${ID}`, "PUT", { name: "X" }),
        conId,
      ),
  ],
  [
    "POST /api/catalog/product/image-upload",
    () => IMAGE_UPLOAD(json("/api/catalog/product/image-upload", "POST", {})),
  ],
  [
    "POST /api/catalog/category",
    () => CATEGORY_POST(json("/api/catalog/category", "POST", { name: "X" })),
  ],
  [
    "PUT /api/catalog/category/:id",
    () =>
      CATEGORY_PUT(
        json(`/api/catalog/category/${ID}`, "PUT", { name: "X" }),
        conId,
      ),
  ],
  [
    "GET /api/catalog/stock/search",
    () => STOCK_SEARCH(json("/api/catalog/stock/search?q=cafe", "GET")),
  ],
  [
    "POST /api/catalog/imports",
    () => IMPORTS_POST(json("/api/catalog/imports", "POST", {})),
  ],
  [
    "GET /api/catalog/imports",
    () => IMPORTS_GET(json("/api/catalog/imports", "GET")),
  ],
  [
    "GET /api/catalog/imports/:id",
    () => IMPORT_GET(json(`/api/catalog/imports/${ID}`, "GET"), conId),
  ],
  [
    "DELETE /api/catalog/imports/:id",
    () => IMPORT_DELETE(json(`/api/catalog/imports/${ID}`, "DELETE"), conId),
  ],
  [
    "POST /api/catalog/imports/:id/uploads",
    () =>
      IMPORT_UPLOADS(
        json(`/api/catalog/imports/${ID}/uploads`, "POST", {}),
        conId,
      ),
  ],
  [
    "POST /api/catalog/imports/:id/analyze",
    () =>
      IMPORT_ANALYZE(
        json(`/api/catalog/imports/${ID}/analyze`, "POST", {}),
        conId,
      ),
  ],
  [
    "DELETE /api/catalog/product/:id",
    () => PRODUCT_DELETE(json(`/api/catalog/product/${ID}`, "DELETE"), conId),
  ],
  [
    "DELETE /api/catalog/category/:id",
    () => CATEGORY_DELETE(json(`/api/catalog/category/${ID}`, "DELETE"), conId),
  ],
  [
    "DELETE /api/loyalty-program",
    () => PROGRAM_DELETE(json("/api/loyalty-program", "DELETE", {})),
  ],
  [
    "PATCH /api/loyalty-program (cancel-close)",
    () =>
      PROGRAM_PATCH(
        json("/api/loyalty-program", "PATCH", { action: "cancel-close" }),
      ),
  ],
];

/** El `code` del cuerpo, si el cuerpo es JSON. Un cuerpo que no lo es no trae `code`. */
const codeDe = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  try {
    return (JSON.parse(text) as { code?: unknown }).code;
  } catch {
    return undefined;
  }
};

beforeEach(() => {
  // El buscador de stock sin proveedor configurado contestaria un 503 propio: `fake` lo deja
  // llegar a su dominio sin red.
  process.env.STOCK_PROVIDER = "fake";
  world.session = null;
  world.ownerRow = null;
  world.membershipRow = null;
});

describe("catalogo y ciclo del programa sin email verificado — el guard (spec 0165)", () => {
  it("el barrido cubre las 17 entradas de la spec", () => {
    // Piso: una tabla vacia dejaria los `it.each` de abajo sin correr ni una vez, en verde.
    expect(ENTRADAS.length).toBe(17);
  });

  it.each(ENTRADAS)(
    "%s: owner con `emailVerified: false` → pasa el guard (ni 401/403 ni `email_not_verified`)",
    async (_name, call) => {
      world.session = { user: { id: "user-owner", emailVerified: false } };
      world.ownerRow = filaDeOwner("active");
      const response = await call();
      expect(await codeDe(response)).not.toBe("email_not_verified");
      expect([401, 403]).not.toContain(response.status);
    },
  );

  it.each(ENTRADAS)(
    "%s: owner SIN la clave `emailVerified` → pasa igual (el paso del email no corre)",
    async (_name, call) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerRow = filaDeOwner("active");
      const response = await call();
      expect(await codeDe(response)).not.toBe("email_not_verified");
      expect([401, 403]).not.toContain(response.status);
    },
  );
});
