import type { NextConfig } from "next";

// Panel de plataforma (ADR 0135, spec 0190) en `admin.checkpass.club` (ADR 0106).
const nextConfig: NextConfig = {
  // `@mi-pasaporte/db` y `domain` exportan fuente TypeScript (ADR 0107): Next la transpila.
  transpilePackages: ["@mi-pasaporte/db", "@mi-pasaporte/domain"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
