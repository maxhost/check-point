import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0218 — la compuerta del PIN temporal: la REGLA (`pinChangeRequired`) y su CABLEADO en las
 * tres escaleras que alcanzan al integrante (`memberLadder`, `resolveOperator`,
 * `requireBackofficeSession`). Se doblan la sesion, la fila de la membresia y la lectura del
 * cobro; la decision del eje `status` es la real. Las filas llevan `pinMustChange` siempre: la
 * columna es `NOT NULL`, y el owner real nace con `true` (default de la columna).
 */

class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

const world = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; name: string; emailVerified?: boolean };
  },
  row: undefined as undefined | Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));
vi.mock("./billing-gate", () => ({
  businessBillingFailure: async () => null,
  readBusinessBilling: async () => ({ access: "active", trialEndsAt: null }),
}));
vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  membershipContext: async () => world.row ?? null,
}));
vi.mock("./counter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./counter")>()),
  operatorBusiness: async () =>
    world.row
      ? {
          business: { id: "b1", currencyCode: "USD", status: "active" },
          role: world.row.role,
          permissions: world.row.permissions,
          pinMustChange: world.row.pinMustChange,
        }
      : null,
}));
vi.mock("@mi-pasaporte/db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where", "orderBy"]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve(world.row ? [world.row] : []);
  return { getDb: () => chain };
});

import {
  PIN_CHANGE_PAGE,
  PIN_CHANGE_REQUIRED,
  pinChangeRequired,
} from "./pin-change-gate";
import { requireApiPermission } from "./api-permission";
import { requireApiMember } from "./api-member";
import { resolveOperator } from "./operator-guard";
import { requireBackofficeSession } from "./auth-guards";

function member(role: "owner" | "staff", pinMustChange: boolean) {
  return {
    id: "b1",
    name: "Bar",
    slug: "bar",
    countryCode: "EC",
    currencyCode: "USD",
    timezone: "America/Guayaquil",
    status: "active",
    businessStatus: "active",
    suspensionReason: null,
    role,
    permissions: role === "owner" ? [] : ["pos", "counter", "catalog"],
    pinMustChange,
  };
}

const request = () => new Request("https://merchant.test/api/x");

beforeEach(() => {
  world.session = {
    user: { id: "u1", name: "Lucas", emailVerified: true },
  };
  world.row = undefined;
});

describe("pinChangeRequired (la regla)", () => {
  it("staff con el PIN temporal → si", () => {
    expect(pinChangeRequired({ role: "staff", pinMustChange: true })).toBe(
      true,
    );
  });
  it("staff que ya lo cambio → no", () => {
    expect(pinChangeRequired({ role: "staff", pinMustChange: false })).toBe(
      false,
    );
  });
  it("el owner NUNCA, aunque su fila diga `true` (el default de la columna)", () => {
    expect(pinChangeRequired({ role: "owner", pinMustChange: true })).toBe(
      false,
    );
  });
  it("la pantalla del cambio es la del ingreso del equipo", () => {
    expect(PIN_CHANGE_PAGE).toBe("/acceso-equipo?cambiar-pin=1");
  });
});

describe("cableado — escalera de permisos (memberLadder)", () => {
  it("staff con PIN temporal → 403 pin_change_required, tambien en requireApiMember", async () => {
    world.row = member("staff", true);
    for (const auth of [
      await requireApiPermission(request(), "catalog"),
      await requireApiMember(request()),
    ]) {
      expect("failure" in auth && auth.failure).toEqual({
        status: 403,
        code: PIN_CHANGE_REQUIRED,
        message: "Cambia tu PIN temporal para continuar.",
      });
    }
  });

  it("staff que ya lo cambio pasa; el owner con `true` en la fila tambien", async () => {
    for (const row of [member("staff", false), member("owner", true)]) {
      world.row = row;
      const auth = await requireApiPermission(request(), "catalog");
      expect("failure" in auth).toBe(false);
    }
  });
});

describe("cableado — escalera del operador (mostrador y POS)", () => {
  const copy = { missingPermission: "x", emailNotVerified: "y" };

  it("staff con PIN temporal → 403 pin_change_required", async () => {
    world.row = member("staff", true);
    const result = await resolveOperator(request(), "pos", copy);
    expect("response" in result).toBe(true);
    if (!("response" in result)) return;
    expect(result.response.status).toBe(403);
    expect((await result.response.json()).code).toBe(PIN_CHANGE_REQUIRED);
  });

  it("staff que ya lo cambio y owner con `true` pasan", async () => {
    for (const row of [member("staff", false), member("owner", true)]) {
      world.row = row;
      const result = await resolveOperator(request(), "pos", copy);
      expect("response" in result).toBe(false);
    }
  });
});

describe("cableado — paginas del backoffice", () => {
  async function destination(): Promise<string> {
    try {
      await requireBackofficeSession();
    } catch (error) {
      if (error instanceof Redirected) return error.to;
      throw error;
    }
    return "<sin-redirect>";
  }

  it("staff con PIN temporal → la pantalla del cambio", async () => {
    world.row = member("staff", true);
    expect(await destination()).toBe("/acceso-equipo?cambiar-pin=1");
  });

  it("staff que ya lo cambio y owner con `true` entran", async () => {
    for (const row of [member("staff", false), member("owner", true)]) {
      world.row = row;
      expect(await destination()).toBe("<sin-redirect>");
    }
  });
});
