import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0082 §2 — EL GATE DE EMAIL DEL MOSTRADOR, que hasta esta spec no existía en ninguna
 * línea.
 *
 * Por qué hace falta: mientras `requireBackofficeSession` rebotaba en la PUERTA, el mostrador
 * heredaba el corte sin tenerlo propio. Sacado ese rebote (decisión del owner, ADR 0070 §11),
 * un owner sin verificar acreditaría sellos. La decisión del mostrador también es textual
 * (2026-09-19): *«mostrador, tambien entra en cualquier accion requiere verificar email»*.
 *
 * **Por qué vive en `src/server/` y no en `app/api/counter/`**: los 15 archivos de test del
 * mostrador viven acá con prefijo `counter-`, ninguno al lado de la ruta. Y por qué con
 * dobles y no contra Neon: lo que se mide es el GUARD —qué status y qué `code` salen en cada
 * estado del caller—, igual que `api-owner-surfaces.test.ts`. La resolución real contra
 * Postgres ya la miden `counter-redeem-guards.neon.integration` y `business-status.neon`.
 */
const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified?: boolean } },
  operator: null as null | {
    business: { id: string; currencyCode: string; status: string };
    role: string;
    permissions: string[];
  },
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

/**
 * Sólo `operatorBusiness` se dobla; el resto del barril queda REAL, porque `_auth.ts` también
 * importa `CounterError` de ahí y un doble total lo dejaría `undefined` — `counterError()`
 * pasaría a clasificar todo error de dominio como 503 y este archivo no lo vería.
 */
vi.mock("./counter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./counter")>()),
  operatorBusiness: async () => world.operator,
}));

import { requireOperator } from "../app/api/counter/_auth";

/** Spec 0086 §6 — el staff de este archivo lleva `["counter"]` por default, que es lo que le
 * da el ALTA cuando el owner le marca el toggle del mostrador. Sin el, todos los casos de acá
 * frenarian en `missing_permission` y este archivo dejaria de medir el gate de EMAIL, que es
 * lo suyo. El caso del staff SIN el permiso vive en `counter-permission.test.ts`. */
function operator(role: string, status = "active", permissions = ["counter"]) {
  return {
    business: {
      id: "11111111-1111-4111-8111-111111111111",
      currencyCode: "USD",
      status,
    },
    role,
    permissions,
  };
}

/** El desenlace del guard, normalizado: o frenó con `{status, code}`, o dejó pasar. */
async function outcome(): Promise<
  { blocked: true; status: number; code: unknown } | { blocked: false }
> {
  const result = await requireOperator(
    new Request("https://merchant.test/api/counter/resolve", {
      method: "POST",
      headers: { cookie: "session=whatever" },
    }),
  );
  if (!("response" in result)) return { blocked: false };
  return {
    blocked: true,
    status: result.response.status,
    code: (await result.response.json()).code,
  };
}

beforeEach(() => {
  world.session = null;
  world.operator = null;
});

describe("el gate de email del mostrador (spec 0082 §2)", () => {
  /**
   * EL PISO DE LAS CUATRO RUTAS. El gate vive en `requireOperator` y lo que hace que cubra el
   * mostrador entero es que las cuatro entradas pasen por ahí: una ruta que resolviera la
   * sesión por su cuenta quedaría afuera del gate sin que ningún caso de abajo lo note.
   */
  it("las CUATRO rutas del mostrador entran por `requireOperator`", () => {
    const rutas = ["resolve", "grant", "redeem", "coupon-redeem"];
    for (const ruta of rutas) {
      const source = readFileSync(
        new URL(`../app/api/counter/${ruta}/route.ts`, import.meta.url),
        "utf8",
      );
      // Piso: un archivo vacío o movido pasaría un `toContain` sobre nada.
      expect(source.length).toBeGreaterThan(200);
      expect(source).toContain("await requireOperator(request)");
    }
  });

  it("owner con `emailVerified: false` → 403 `email_not_verified`", async () => {
    world.session = { user: { id: "u-owner", emailVerified: false } };
    world.operator = operator("owner");
    expect(await outcome()).toEqual({
      blocked: true,
      status: 403,
      code: "email_not_verified",
    });
  });

  // Fail-closed en el DATO: un `undefined` —una fila vieja, un doble incompleto— cierra.
  it("owner SIN la clave `emailVerified` → 403 igual (fail-closed)", async () => {
    world.session = { user: { id: "u-owner" } };
    world.operator = operator("owner");
    expect(await outcome()).toEqual({
      blocked: true,
      status: 403,
      code: "email_not_verified",
    });
  });

  /**
   * LA TRAMPA CENTRAL, y la mutación #1 del presupuesto. El staff no tiene email por diseño
   * (`@staff.invalid`, spec 0067 §4, que nunca se entrega): si el gate lo alcanzara, el
   * mostrador quedaría muerto PARA SIEMPRE y ninguna acción podría desbloquearlo. Sin este
   * caso, borrar `role === "owner"` del gate no pone rojo a nadie.
   */
  it("staff con `emailVerified: false` PASA — no tiene email por diseño", async () => {
    world.session = { user: { id: "u-staff", emailVerified: false } };
    world.operator = operator("staff");
    expect(await outcome()).toEqual({ blocked: false });
  });

  it("staff SIN la clave `emailVerified` también pasa", async () => {
    world.session = { user: { id: "u-staff" } };
    world.operator = operator("staff");
    expect(await outcome()).toEqual({ blocked: false });
  });

  it("owner con `emailVerified: true` pasa", async () => {
    world.session = { user: { id: "u-owner", emailVerified: true } };
    world.operator = operator("owner");
    expect(await outcome()).toEqual({ blocked: false });
  });

  /**
   * EL ORDEN RESPECTO DEL EJE `status` (ADR 0073 §1), que es una decisión y no un descuido:
   * el email va ANTES, el mismo orden que `requireApiOwner` y `requireBackofficeSession`,
   * «para que las dos superficies contesten lo mismo ante el mismo caller». Cambia un caso
   * observable, y por eso lleva oráculo propio.
   */
  it("owner sin verificar sobre un negocio `suspended` → `email_not_verified`, NO `business_suspended`", async () => {
    world.session = { user: { id: "u-owner", emailVerified: false } };
    world.operator = operator("owner", "suspended");
    expect(await outcome()).toEqual({
      blocked: true,
      status: 403,
      code: "email_not_verified",
    });
  });

  /**
   * ANTI-FALSO-VERDE del caso de arriba: con el MISMO negocio `suspended` y el email
   * verificado, el eje `status` sí contesta. Sin esto, un `status` que el guard ignorara daría
   * `email_not_verified` por el motivo equivocado y el par «el orden» no probaría nada.
   */
  it("y el eje `status` sigue vivo: owner verificado sobre `suspended` → `business_suspended`", async () => {
    world.session = { user: { id: "u-owner", emailVerified: true } };
    world.operator = operator("owner", "suspended");
    expect(await outcome()).toEqual({
      blocked: true,
      status: 403,
      code: "business_suspended",
    });
  });

  it("sin sesión sigue siendo 401, antes que cualquier otra cosa", async () => {
    world.session = null;
    world.operator = operator("owner");
    const result = await outcome();
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.status).toBe(401);
  });
});
