import { describe, expect, it } from "vitest";
import nextConfig, { consumerRedirects } from "../next.config";

/** Spec 0117 §2 / ADR 0109 §2: la raiz de `my.` es un 308 a `/wallet`. */
describe("consumer root redirect", () => {
  // ORACULO DE M5: sin esta regla `/` da 404 en el dominio del cliente.
  it("`/` → `/wallet`, permanent (308), and nothing else", () => {
    expect(consumerRedirects()).toEqual([
      { source: "/", destination: "/wallet", permanent: true },
    ]);
  });

  it("is what next.config.ts hands to Next", async () => {
    expect(nextConfig.redirects).toBeTypeOf("function");
    await expect(nextConfig.redirects?.()).resolves.toEqual(
      consumerRedirects(),
    );
  });
});
