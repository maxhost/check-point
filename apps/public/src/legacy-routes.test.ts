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
        source: "/es/business/:path*",
        destination: `${BUSINESS}/es/business/:path*`,
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
  // ORACULO DE M5 (0114): `/api/*` de `www` se reenvia a merchant (MERCHANT_API_ORIGIN).
  // ORACULO DE M4 (0117): primero `/api/public/*` al cliente — Next toma la primera regla que
  // matchea, y con el orden invertido `/api/public` iria a merchant.
  it("proxies /api/public/:path* to CONSUMER_API_ORIGIN first, then /api/:path* to MERCHANT_API_ORIGIN — and nothing else", () => {
    expect(
      legacyRewrites("https://api-origin.test", "https://consumer-api.test"),
    ).toEqual([
      {
        source: "/api/public/:path*",
        destination: "https://consumer-api.test/api/public/:path*",
      },
      {
        source: "/api/:path*",
        destination: "https://api-origin.test/api/:path*",
      },
    ]);
  });
});

describe("legacyOriginsFromEnv", () => {
  it("defaults to business. / my. / business. / my.", () => {
    expect(legacyOriginsFromEnv({})).toEqual({
      merchantOrigin: BUSINESS,
      consumerOrigin: MY,
      merchantApiOrigin: BUSINESS,
      consumerApiOrigin: MY,
    });
    expect(
      legacyOriginsFromEnv({
        MERCHANT_ORIGIN: " ",
        CONSUMER_ORIGIN: "",
        MERCHANT_API_ORIGIN: "",
        CONSUMER_API_ORIGIN: " ",
      }),
    ).toEqual({
      merchantOrigin: BUSINESS,
      consumerOrigin: MY,
      merchantApiOrigin: BUSINESS,
      consumerApiOrigin: MY,
    });
  });

  it("reads MERCHANT_ORIGIN, CONSUMER_ORIGIN, MERCHANT_API_ORIGIN and CONSUMER_API_ORIGIN", () => {
    expect(
      legacyOriginsFromEnv({
        MERCHANT_ORIGIN: "https://b.test/",
        CONSUMER_ORIGIN: "https://m.test",
        MERCHANT_API_ORIGIN: "https://merchant-prod.vercel.app",
        CONSUMER_API_ORIGIN: "https://consumer-prod.vercel.app/",
      }),
    ).toEqual({
      merchantOrigin: "https://b.test",
      consumerOrigin: "https://m.test",
      merchantApiOrigin: "https://merchant-prod.vercel.app",
      consumerApiOrigin: "https://consumer-prod.vercel.app",
    });
  });
});
