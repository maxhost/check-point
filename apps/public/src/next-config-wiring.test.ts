import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import {
  legacyOriginsFromEnv,
  legacyRedirects,
  legacyRewrites,
} from "./legacy-routes";

/**
 * Spec 0117 (revisor): `legacyRewrites(merchantApiOrigin, consumerApiOrigin)` recibe dos
 * `string`, asi que invertirlos en `next.config.ts` tipa igual y ningun test de
 * `legacy-routes` lo ve — `/api/public/*` (pases de Apple, callback de Google) iria a
 * merchant. Esto pinnea el CABLEADO: lo que `next.config.ts` le entrega a Next.
 */
describe("next.config.ts hands Next exactly the legacy routes", () => {
  const origins = legacyOriginsFromEnv(process.env);

  it("rewrites: /api/public → consumer, the rest of /api → merchant", async () => {
    await expect(nextConfig.rewrites?.()).resolves.toEqual(
      legacyRewrites(origins.merchantApiOrigin, origins.consumerApiOrigin),
    );
  });

  it("redirects are the legacy list", async () => {
    await expect(nextConfig.redirects?.()).resolves.toEqual(
      legacyRedirects(origins.merchantOrigin, origins.consumerOrigin),
    );
  });
});
