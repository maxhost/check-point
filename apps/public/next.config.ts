import type { NextConfig } from "next";
import {
  legacyOriginsFromEnv,
  legacyRedirects,
  legacyRewrites,
} from "./src/legacy-routes";

// Un subdominio por audiencia (ADR 0106, spec 0114): esta app es `www.checkpass.club` y
// conserva la capa de compatibilidad de lo que ya tiene `www` grabado — 308 de las
// paginas viejas a `business.`/`my.`, proxy de `/api/public/*` al cliente y del resto de
// `/api/*` a merchant (`src/legacy-routes.ts`).
const origins = legacyOriginsFromEnv(process.env);

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRedirects(origins.merchantOrigin, origins.consumerOrigin);
  },
  async rewrites() {
    return legacyRewrites(origins.merchantApiOrigin, origins.consumerApiOrigin);
  },
};

export default nextConfig;
