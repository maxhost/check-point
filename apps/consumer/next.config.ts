import type { NextConfig } from "next";

/** `my.checkpass.club/` no tiene pagina propia: la raiz manda a la billetera (ADR 0109 §2). */
export function consumerRedirects() {
  return [{ source: "/", destination: "/wallet", permanent: true as const }];
}

const nextConfig: NextConfig = {
  // Los paquetes del monorepo exportan fuente TypeScript (ADR 0107, 0108): Next la transpila.
  transpilePackages: ["@mi-pasaporte/db", "@mi-pasaporte/domain"],
  // IP LAN de la sesión de QA. Actualizarla si cambia la red Wi-Fi.
  allowedDevOrigins: ["192.168.100.7"],
  async redirects() {
    return consumerRedirects();
  },
};

export default nextConfig;
