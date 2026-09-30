import { describe, expect, it } from "vitest";
import {
  legacyOriginsFromEnv,
  legacyRedirects,
  legacyRewrites,
} from "./legacy-routes";

/** La capa de compatibilidad de `www` (spec 0114 §6 / ADR 0106 §4): entradas exactas. */

const BUSINESS = "https://business.checkpass.club";
const MY = "https://my.checkpass.club";

describe("legacyRedirects", () => {
  it("is exactly the §6 list: merchant pages → business., consumer pages → my., all 308", () => {
    expect(legacyRedirects(BUSINESS, MY)).toEqual([
      {
        source: "/backoffice",
        destination: `${BUSINESS}/backoffice`,
        permanent: true,
      },
      {
        source: "/backoffice/:path*",
        destination: `${BUSINESS}/backoffice/:path*`,
        permanent: true,
      },
      {
        source: "/:locale/business/:path*",
        destination: `${BUSINESS}/:locale/business/:path*`,
        permanent: true,
      },
      { source: "/wallet", destination: `${MY}/wallet`, permanent: true },
      {
        source: "/wallet/:path*",
        destination: `${MY}/wallet/:path*`,
        permanent: true,
      },
      { source: "/c/:path*", destination: `${MY}/c/:path*`, permanent: true },
      {
        source: "/enroll/:path*",
        destination: `${MY}/enroll/:path*`,
        permanent: true,
      },
      { source: "/recover", destination: `${MY}/recover`, permanent: true },
      {
        source: "/recover/:path*",
        destination: `${MY}/recover/:path*`,
        permanent: true,
      },
    ]);
  });

  it("never redirects /api (that one is a proxy, H5)", () => {
    const sources = legacyRedirects(BUSINESS, MY).map((r) => r.source);
    expect(sources.some((s) => s.startsWith("/api"))).toBe(false);
  });

  it("a trailing slash on an origin does not produce `//`", () => {
    const [first] = legacyRedirects(`${BUSINESS}/`, `${MY}/`);
    expect(first.destination).toBe(`${BUSINESS}/backoffice`);
  });
});

describe("legacyRewrites", () => {
  // ORACULO DE M5: `/api/*` de `www` se reenvia a merchant (MERCHANT_API_ORIGIN).
  it("proxies /api/:path* to MERCHANT_API_ORIGIN — and nothing else", () => {
    expect(legacyRewrites("https://api-origin.test")).toEqual([
      {
        source: "/api/:path*",
        destination: "https://api-origin.test/api/:path*",
      },
    ]);
  });
});

describe("legacyOriginsFromEnv", () => {
  it("defaults to business. / my. / business.", () => {
    expect(legacyOriginsFromEnv({})).toEqual({
      merchantOrigin: BUSINESS,
      consumerOrigin: MY,
      merchantApiOrigin: BUSINESS,
    });
    expect(
      legacyOriginsFromEnv({
        MERCHANT_ORIGIN: " ",
        CONSUMER_ORIGIN: "",
        MERCHANT_API_ORIGIN: "",
      }),
    ).toEqual({
      merchantOrigin: BUSINESS,
      consumerOrigin: MY,
      merchantApiOrigin: BUSINESS,
    });
  });

  it("reads MERCHANT_ORIGIN, CONSUMER_ORIGIN and MERCHANT_API_ORIGIN", () => {
    expect(
      legacyOriginsFromEnv({
        MERCHANT_ORIGIN: "https://b.test/",
        CONSUMER_ORIGIN: "https://m.test",
        MERCHANT_API_ORIGIN: "https://merchant-prod.vercel.app",
      }),
    ).toEqual({
      merchantOrigin: "https://b.test",
      consumerOrigin: "https://m.test",
      merchantApiOrigin: "https://merchant-prod.vercel.app",
    });
  });
});
