import { describe, expect, it } from "vitest";
import {
  STAFF_ENTRY_PATH,
  decideHostRoute,
  isStaffHost,
} from "@mi-pasaporte/domain/server/hosts";

/**
 * Spec 0218 / ADR 0140 — la TERCERA audiencia (`staff.`) en `decideHostRoute`. La tabla de dos
 * audiencias sigue en `hosts.test.ts`, que no pasa `staffOrigin` (H1 de la 0218: sin la
 * variable, todo como antes).
 */

const MERCHANT = "https://business.checkpass.club";
const CONSUMER = "https://my.checkpass.club";
const STAFF = "https://staff.checkpass.club";

function route(
  host: string | null,
  path: string,
  staffOrigin: string | null = STAFF,
) {
  const url = new URL(path, "https://x.invalid");
  return decideHostRoute({
    host,
    pathname: url.pathname,
    search: url.search,
    merchantOrigin: MERCHANT,
    consumerOrigin: CONSUMER,
    staffOrigin,
  });
}

describe("decideHostRoute — staff.", () => {
  it("`/` se REESCRIBE al ingreso del equipo (la URL queda en la portada), con su query", () => {
    expect(route("staff.checkpass.club", "/")).toEqual({
      rewrite: STAFF_ENTRY_PATH,
    });
    expect(route("staff.checkpass.club", "/?e=staff_disabled")).toEqual({
      rewrite: `${STAFF_ENTRY_PATH}?e=staff_disabled`,
    });
    expect(STAFF_ENTRY_PATH).toBe("/acceso-equipo");
  });

  it.each([
    "/backoffice",
    "/backoffice/pos",
    "/backoffice/catalog?x=1",
    "/acceso-equipo",
    "/acceso-equipo?cambiar-pin=1",
  ])("%s sigue en staff.", (path) => {
    expect(route("staff.checkpass.club", path)).toBeNull();
  });

  it.each([
    ["/es/business/onboarding", `${MERCHANT}/es/business/onboarding`],
    ["/es/business?signup=1", `${MERCHANT}/es/business?signup=1`],
  ])("una pagina del dueño %s → 308 a business. (%s)", (path, target) => {
    expect(route("staff.checkpass.club", path)).toEqual({ redirect: target });
  });

  it.each([
    ["/wallet", `${CONSUMER}/wallet`],
    ["/c/WVT", `${CONSUMER}/c/WVT`],
    ["/enroll/p-1?loc=9", `${CONSUMER}/enroll/p-1?loc=9`],
  ])("una pagina del cliente %s → 308 a my. (%s)", (path, target) => {
    expect(route("staff.checkpass.club", path)).toEqual({ redirect: target });
  });

  it("H3: `/api` nunca, tampoco en staff.", () => {
    for (const path of [
      "/api",
      "/api/merchant/auth/staff",
      "/api/business/x",
      "/_next/static/a.js",
      "/robots.txt",
    ]) {
      expect(route("staff.checkpass.club", path)).toBeNull();
    }
  });

  it("el host se compara sin puerto y sin mayusculas", () => {
    expect(route("Staff.CheckPass.Club:443", "/")).toEqual({
      rewrite: STAFF_ENTRY_PATH,
    });
  });
});

describe("decideHostRoute — el ingreso del equipo pedido en business.", () => {
  it("`/acceso-equipo` → 308 a la portada de staff., con el query", () => {
    expect(route("business.checkpass.club", "/acceso-equipo")).toEqual({
      redirect: `${STAFF}/`,
    });
    expect(
      route("business.checkpass.club", "/acceso-equipo?cambiar-pin=1"),
    ).toEqual({ redirect: `${STAFF}/?cambiar-pin=1` });
  });

  it("la portada y el panel del dueño siguen en business.", () => {
    for (const path of ["/", "/backoffice", "/backoffice/pos"]) {
      expect(route("business.checkpass.club", path)).toBeNull();
    }
  });
});

describe("decideHostRoute — H1 y H2 de la tercera audiencia", () => {
  it("H1: sin STAFF_ORIGIN el host staff. no se trata distinto", () => {
    for (const path of ["/", "/backoffice", "/es/business/x", "/wallet"]) {
      expect(route("staff.checkpass.club", path, null)).toBeNull();
      expect(route("staff.checkpass.club", path, "   ")).toBeNull();
    }
    expect(route("business.checkpass.club", "/acceso-equipo", null)).toBeNull();
  });

  it("H1: sin los otros dos origenes tampoco se enruta staff.", () => {
    expect(
      decideHostRoute({
        host: "staff.checkpass.club",
        pathname: "/",
        search: "",
        merchantOrigin: undefined,
        consumerOrigin: CONSUMER,
        staffOrigin: STAFF,
      }),
    ).toBeNull();
  });

  it("STAFF_ORIGIN con el host de otra audiencia no se enruta (seria bucle)", () => {
    expect(route("business.checkpass.club", "/", MERCHANT)).toBeNull();
    expect(
      route("business.checkpass.club", "/acceso-equipo", MERCHANT),
    ).toBeNull();
    expect(route("my.checkpass.club", "/", CONSUMER)).toEqual({
      redirect: `${CONSUMER}/wallet`,
    });
  });

  it("H2: solo el host exacto de STAFF_ORIGIN", () => {
    for (const host of [
      "staff.checkpass.club.evil.test",
      "x.staff.checkpass.club",
      "localhost:3000",
    ]) {
      expect(route(host, "/")).toBeNull();
    }
  });
});

describe("decideHostRoute — sin bucle con tres audiencias", () => {
  it("ningun destino vuelve a redirigir", () => {
    const hosts = [
      "business.checkpass.club",
      "my.checkpass.club",
      "staff.checkpass.club",
    ];
    const paths = [
      "/",
      "/acceso-equipo",
      "/acceso-equipo?cambiar-pin=1",
      "/backoffice",
      "/backoffice/pos",
      "/es/business/o",
      "/wallet",
      "/wallet/business",
      "/c/t",
      "/enroll/business",
    ];
    let redirects = 0;
    for (const host of hosts) {
      for (const path of paths) {
        const r = route(host, path);
        if (!r || !("redirect" in r)) continue;
        redirects += 1;
        const target = new URL(r.redirect);
        const next = route(target.host, `${target.pathname}${target.search}`);
        // El destino se sirve: o sigue, o es la reescritura de la portada de staff.
        expect(next === null || "rewrite" in next).toBe(true);
      }
    }
    // business.: 2 de /acceso-equipo + 4 del cliente; my.: `/` + 3 del comercio;
    // staff.: 1 del dueño + 4 del cliente.
    expect(redirects).toBe(15);
  });
});

describe("isStaffHost", () => {
  const base = {
    staffOrigin: STAFF,
    merchantOrigin: MERCHANT,
    consumerOrigin: CONSUMER,
  };
  it("solo el host exacto de STAFF_ORIGIN, sin puerto ni mayusculas", () => {
    expect(isStaffHost({ ...base, host: "staff.checkpass.club" })).toBe(true);
    expect(isStaffHost({ ...base, host: "STAFF.checkpass.club:443" })).toBe(
      true,
    );
    for (const host of [
      "business.checkpass.club",
      "my.checkpass.club",
      "x.staff.checkpass.club",
      "localhost:3000",
      null,
    ]) {
      expect(isStaffHost({ ...base, host })).toBe(false);
    }
  });

  it("sin STAFF_ORIGIN, o con el host de otra audiencia, nunca", () => {
    expect(
      isStaffHost({
        ...base,
        staffOrigin: undefined,
        host: "staff.checkpass.club",
      }),
    ).toBe(false);
    expect(
      isStaffHost({
        ...base,
        staffOrigin: MERCHANT,
        host: "business.checkpass.club",
      }),
    ).toBe(false);
  });
});
