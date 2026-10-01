import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los paquetes del monorepo exportan fuente TypeScript (ADR 0107, 0108): Next la transpila.
  transpilePackages: ["@mi-pasaporte/db", "@mi-pasaporte/domain"],
  // IP LAN de la sesión de QA. Actualizarla si cambia la red Wi-Fi.
  allowedDevOrigins: ["192.168.100.7"],
};

export default nextConfig;
