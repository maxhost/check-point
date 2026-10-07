import type { NextConfig } from "next";

/** `my.checkpass.club/` no tiene pagina propia: la raiz manda a la billetera (ADR 0109 §2). */
export function consumerRedirects() {
  return [{ source: "/", destination: "/wallet", permanent: true as const }];
}

const nextConfig: NextConfig = {
  // Los paquetes del monorepo exportan fuente TypeScript (ADR 0107, 0108): Next la transpila.
  transpilePackages: ["@mi-pasaporte/db", "@mi-pasaporte/domain"],
  // The per-consumer manifest must be in <head> on the first HTML response so
  // Chrome can evaluate installability before the confirmation is interactive.
  htmlLimitedBots: /.*/,
  // IP LAN de la sesión de QA (actualizarla si cambia la red Wi-Fi) y el tunel `dev-my.` (ADR 0127).
  allowedDevOrigins: ["192.168.100.7", "dev-my.checkpass.club"],
  async redirects() {
    return consumerRedirects();
  },
};

export default nextConfig;
