import type { NextConfig } from "next";

// Multi-zones (docs/despliegue-publico.md): con `PUBLIC_APP_ORIGIN` (el dominio de produccion
// del proyecto Vercel de `apps/public`, sin barra final) las rutas de la web publica se
// sirven desde esa app bajo este mismo dominio; el alta, la wallet, el backoffice y la API
// siguen aca. Sin la variable no se reescribe nada.
const PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN?.replace(/\/+$/, "");

const PUBLIC_PATHS = [
  "/",
  "/explorar",
  "/negocios",
  "/lugares/:slug",
  "/robots.txt",
  "/sitemap.xml",
  "/icon.svg",
  "/images/:path*",
  "/public-zone/:path*",
];

const nextConfig: NextConfig = {
  // Playwright usa 127.0.0.1; la IP LAN permite QA manual desde el teléfono.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.100.7"],
  async rewrites() {
    if (!PUBLIC_APP_ORIGIN) return [];
    return {
      beforeFiles: PUBLIC_PATHS.map((source) => ({
        source,
        destination: `${PUBLIC_APP_ORIGIN}${source}`,
      })),
    };
  },
};

export default nextConfig;
