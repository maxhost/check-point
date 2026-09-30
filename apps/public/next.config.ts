import type { NextConfig } from "next";

// Multi-zones (docs/despliegue-publico.md): www.checkpass.club lo sirve el proyecto merchant,
// que reescribe las rutas publicas hacia este. Los assets de esta app viajan bajo
// `/public-zone` para no chocar con los `/_next` de merchant en el mismo dominio; el rewrite
// de abajo los sigue sirviendo cuando se entra directo al dominio de este proyecto.
const nextConfig: NextConfig = {
  assetPrefix:
    process.env.NODE_ENV === "production" ? "/public-zone" : undefined,
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/public-zone/_next/:path+", destination: "/_next/:path+" },
      ],
    };
  },
};

export default nextConfig;
