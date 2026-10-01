import type { NextConfig } from "next";

// Un subdominio por audiencia (ADR 0106, spec 0114): merchant sirve `business.` y `my.`;
// el enrutamiento por host vive en `src/proxy.ts`. La web publica es otro proyecto con su
// propio dominio, sin rewrites entre los dos.
const nextConfig: NextConfig = {
  // `@mi-pasaporte/db` exporta fuente TypeScript (ADR 0107): Next la transpila.
  transpilePackages: ["@mi-pasaporte/db", "@mi-pasaporte/domain"],
  // Playwright usa 127.0.0.1; la IP LAN permite QA manual desde el teléfono.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.100.7"],
};

export default nextConfig;
