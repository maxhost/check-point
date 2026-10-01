import { describe, expect, it } from "vitest";
import nextConfig, { consumerApiRewrites } from "../../next.config";

/**
 * Spec 0117 §6 / ADR 0109 §4: merchant ya no sirve `/api/public/*` pero lo reenvia al
 * cliente — los pases de Apple y los callbacks con `business.` grabado siguen andando.
 */
describe("merchant proxies /api/public/* to the consumer app", () => {
  // ORACULO DE M3: sin esta regla un pase ya emitido recibe 404 de merchant.
  it("defaults to my.checkpass.club", () => {
    expect(consumerApiRewrites({})).toEqual([
      {
        source: "/api/public/:path*",
        destination: "https://my.checkpass.club/api/public/:path*",
      },
    ]);
  });

  it("reads CONSUMER_ORIGIN (trailing slash trimmed, blank = default)", () => {
    expect(consumerApiRewrites({ CONSUMER_ORIGIN: "https://m.test/" })).toEqual(
      [
        {
          source: "/api/public/:path*",
          destination: "https://m.test/api/public/:path*",
        },
      ],
    );
    expect(consumerApiRewrites({ CONSUMER_ORIGIN: " " })[0].destination).toBe(
      "https://my.checkpass.club/api/public/:path*",
    );
  });

  it("is what next.config.ts hands to Next", async () => {
    expect(nextConfig.rewrites).toBeTypeOf("function");
    await expect(nextConfig.rewrites?.()).resolves.toEqual(
      consumerApiRewrites(process.env),
    );
  });
});
