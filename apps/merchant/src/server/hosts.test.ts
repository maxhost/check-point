import { describe, expect, it } from "vitest";
import { consumerOriginOr, decideHostRoute } from "./hosts";

/**
 * La tabla de casos de `decideHostRoute` (spec 0114 §1, H1–H4). El cableado a
 * `src/proxy.ts` se mide con los dos servidores de la DoD, no aca.
 */

const MERCHANT = "https://business.checkpass.club";
const CONSUMER = "https://my.checkpass.club";

function route(host: string | null, path: string, env = true) {
  const url = new URL(path, "https://x.invalid");
  return decideHostRoute({
    host,
    pathname: url.pathname,
    search: url.search,
    merchantOrigin: env ? MERCHANT : undefined,
    consumerOrigin: env ? CONSUMER : undefined,
  });
}

describe("decideHostRoute — business.", () => {
  // ORACULO DE M1: una pagina del cliente en `business.` va a `my.`.
  it.each([
    ["/wallet", `${CONSUMER}/wallet`],
    ["/wallet/settings", `${CONSUMER}/wallet/settings`],
    ["/c/WVT", `${CONSUMER}/c/WVT`],
    ["/enroll/prog-1?loc=loc-9", `${CONSUMER}/enroll/prog-1?loc=loc-9`],
    ["/recover", `${CONSUMER}/recover`],
    ["/recover/code", `${CONSUMER}/recover/code`],
  ])("a consumer page %s → 308 to my. (%s)", (path, target) => {
    expect(route("business.checkpass.club", path)).toEqual({
      redirect: target,
    });
  });

  it.each([
    "/",
    "/backoffice",
    "/backoffice/brand/kit",
    "/es/business/onboarding",
    "/api/health",
    "/_next/static/chunks/app.js",
    "/wallet/manifest.webmanifest",
    "/walletx",
    "/enroll",
  ])("%s stays on business.", (path) => {
    expect(route("business.checkpass.club", path)).toBeNull();
  });
});

describe("decideHostRoute — my.", () => {
  // ORACULO DE M2: una pagina del comercio en `my.` va a `business.`, con su query.
  it.each([
    ["/backoffice/x?a=1", `${MERCHANT}/backoffice/x?a=1`],
    ["/backoffice", `${MERCHANT}/backoffice`],
    ["/es/business/onboarding", `${MERCHANT}/es/business/onboarding`],
    ["/es/business", `${MERCHANT}/es/business`],
  ])("a merchant page %s → 308 to business. (%s)", (path, target) => {
    expect(route("my.checkpass.club", path)).toEqual({ redirect: target });
  });

  it("H4: `/` → 308 to `/wallet` on my.", () => {
    expect(route("my.checkpass.club", "/")).toEqual({
      redirect: `${CONSUMER}/wallet`,
    });
  });

  // ORACULO DE M3: la API se atiende en los dos hosts (H3). Las paginas se reconocen por
  // lista blanca, asi que la unica `/api` que la exclusion salva hoy es `/api/business/*`
  // (tiene la forma de `/<locale>/business/*`): sin ese caso, borrar la exclusion da verde.
  it.each([
    "/api/business/webhook",
    "/api/public/wallet/passkit/v1/log",
    "/api/health",
    "/api",
    "/_next/static/chunks/app.js",
    "/wallet",
    "/c/WVT",
    "/enroll/prog-1",
  ])("%s stays on my.", (path) => {
    expect(route("my.checkpass.club", path)).toBeNull();
  });
});

describe("decideHostRoute — H1 and H2", () => {
  it("H1: without the two origins nothing is redirected", () => {
    expect(route("business.checkpass.club", "/wallet", false)).toBeNull();
    expect(route("my.checkpass.club", "/backoffice", false)).toBeNull();
    expect(route("my.checkpass.club", "/", false)).toBeNull();
    for (const [merchantOrigin, consumerOrigin] of [
      [MERCHANT, undefined],
      [undefined, CONSUMER],
      ["", CONSUMER],
      [MERCHANT, "   "],
    ]) {
      expect(
        decideHostRoute({
          host: "business.checkpass.club",
          pathname: "/wallet",
          search: "",
          merchantOrigin,
          consumerOrigin,
        }),
      ).toBeNull();
    }
  });

  it.each([
    "www.checkpass.club",
    "checkpass.club",
    "check-point-merchant.vercel.app",
    "localhost:3000",
    "127.0.0.1:3000",
    "[::1]:3000",
  ])("H2: host %s is never touched", (host) => {
    for (const path of ["/", "/wallet", "/backoffice", "/es/business/x"]) {
      expect(route(host, path)).toBeNull();
    }
  });

  it("no host header → no redirect", () => {
    expect(route(null, "/wallet")).toBeNull();
  });

  it("the host is compared without port and case-insensitively", () => {
    expect(route("Business.CheckPass.Club:443", "/wallet?x=1")).toEqual({
      redirect: `${CONSUMER}/wallet?x=1`,
    });
    expect(route("MY.checkpass.club:8080", "/backoffice")).toEqual({
      redirect: `${MERCHANT}/backoffice`,
    });
  });

  it("origins with a trailing slash do not produce `//`", () => {
    expect(
      decideHostRoute({
        host: "business.checkpass.club",
        pathname: "/wallet",
        search: "",
        merchantOrigin: `${MERCHANT}/`,
        consumerOrigin: `${CONSUMER}/`,
      }),
    ).toEqual({ redirect: `${CONSUMER}/wallet` });
  });

  it("the same host for both origins is not routed (it would loop)", () => {
    expect(
      decideHostRoute({
        host: "business.checkpass.club",
        pathname: "/wallet",
        search: "",
        merchantOrigin: MERCHANT,
        consumerOrigin: MERCHANT,
      }),
    ).toBeNull();
  });

  it("no loop: the target of a redirect is served, not redirected again", () => {
    // `/wallet/business` & co. (revisor 0114): paginas del cliente cuyo 2.º segmento es
    // «business» — con una regex de locale amplia tambien parecian del comercio y rebotaban.
    const paths = [
      "/",
      "/wallet",
      "/c/t",
      "/backoffice",
      "/es/business/o",
      "/wallet/business",
      "/c/business",
      "/enroll/business",
      "/recover/business",
    ];
    let redirects = 0;
    for (const host of ["business.checkpass.club", "my.checkpass.club"]) {
      for (const path of paths) {
        const r = route(host, path);
        if (!r) continue;
        redirects += 1;
        const target = new URL(r.redirect);
        expect(route(target.host, `${target.pathname}${target.search}`)).toBe(
          null,
        );
      }
    }
    expect(redirects).toBe(9);
  });
});

describe("consumerOriginOr", () => {
  it("uses CONSUMER_ORIGIN when set (trailing slash trimmed)", () => {
    expect(
      consumerOriginOr("https://www.checkpass.club", {
        CONSUMER_ORIGIN: "https://my.checkpass.club/",
      }),
    ).toBe("https://my.checkpass.club");
  });

  it("falls back to the request origin without it", () => {
    expect(consumerOriginOr("https://www.checkpass.club", {})).toBe(
      "https://www.checkpass.club",
    );
    expect(
      consumerOriginOr("https://www.checkpass.club", { CONSUMER_ORIGIN: " " }),
    ).toBe("https://www.checkpass.club");
  });
});
