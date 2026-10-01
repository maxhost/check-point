import type { NextConfig } from "next";

// Un subdominio por audiencia (ADR 0106, spec 0114): merchant sirve `business.`; el
// enrutamiento por host vive en `src/proxy.ts` (308 de las paginas del cliente a `my.`).
// El cliente es su propio proyecto (ADR 0109, spec 0117).

export const DEFAULT_CONSUMER_ORIGIN = "https://my.checkpass.club";

/**
 * PROXY de `/api/public/*` al cliente (ADR 0109 §4). Los pases de Apple ya emitidos y los
 * callbacks de Wallet tienen `business.` grabado y no siguen un 308 con garantia: merchant ya
 * no sirve esas rutas, las reenvia.
 */
export function consumerApiRewrites(env: Record<string, string | undefined>) {
  const origin = (
    env.CONSUMER_ORIGIN?.trim() || DEFAULT_CONSUMER_ORIGIN
  ).replace(/\/+$/, "");
  return [
    {
      source: "/api/public/:path*",
      destination: `${origin}/api/public/:path*`,
    },
  ];
}

const nextConfig: NextConfig = {
  // `@mi-pasaporte/db` exporta fuente TypeScript (ADR 0107): Next la transpila.
  transpilePackages: ["@mi-pasaporte/db", "@mi-pasaporte/domain"],
  // Playwright usa 127.0.0.1; la IP LAN permite QA manual desde el teléfono.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.100.7"],
  async rewrites() {
    return consumerApiRewrites(process.env);
  },
};

export default nextConfig;
