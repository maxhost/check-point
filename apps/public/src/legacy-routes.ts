/**
 * LA CAPA DE COMPATIBILIDAD DE `www` (spec 0114 / ADR 0106 §4), pura.
 *
 * Pases de Wallet, QR impresos, Stripe y los crons ya tienen `www.checkpass.club` grabado y
 * no se pueden reescribir. Cuando `www` pasa a ser esta web publica:
 * - las paginas viejas del comercio → 308 a `business.`; las del cliente → 308 a `my.`
 *   (Next pasa la query al destino);
 * - `/api/*` → PROXY (rewrite) a merchant, no 308: un `POST` de Stripe, de un cron o de un
 *   iPhone no sigue un 308 con garantia (H5).
 */

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

export type LegacyRewrite = { source: string; destination: string };

export type LegacyOrigins = {
  merchantOrigin: string;
  consumerOrigin: string;
  merchantApiOrigin: string;
};

export const DEFAULT_MERCHANT_ORIGIN = "https://business.checkpass.club";
export const DEFAULT_CONSUMER_ORIGIN = "https://my.checkpass.club";

const MERCHANT_PATHS = [
  "/backoffice",
  "/backoffice/:path*",
  "/:locale/business/:path*",
];

const CONSUMER_PATHS = [
  "/wallet",
  "/wallet/:path*",
  "/c/:path*",
  "/enroll/:path*",
  "/recover",
  "/recover/:path*",
];

function trimOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/** Los tres origenes desde el env, con sus defaults (`MERCHANT_API_ORIGIN` → `business.`). */
export function legacyOriginsFromEnv(
  env: Record<string, string | undefined>,
): LegacyOrigins {
  const pick = (value: string | undefined, fallback: string) =>
    trimOrigin(value?.trim() ? value : fallback);
  return {
    merchantOrigin: pick(env.MERCHANT_ORIGIN, DEFAULT_MERCHANT_ORIGIN),
    consumerOrigin: pick(env.CONSUMER_ORIGIN, DEFAULT_CONSUMER_ORIGIN),
    merchantApiOrigin: pick(env.MERCHANT_API_ORIGIN, DEFAULT_MERCHANT_ORIGIN),
  };
}

export function legacyRedirects(
  merchantOrigin: string,
  consumerOrigin: string,
): LegacyRedirect[] {
  const to = (origin: string) => (source: string) => ({
    source,
    destination: `${trimOrigin(origin)}${source}`,
    permanent: true as const,
  });
  return [
    ...MERCHANT_PATHS.map(to(merchantOrigin)),
    ...CONSUMER_PATHS.map(to(consumerOrigin)),
  ];
}

export function legacyRewrites(merchantApiOrigin: string): LegacyRewrite[] {
  return [
    {
      source: "/api/:path*",
      destination: `${trimOrigin(merchantApiOrigin)}/api/:path*`,
    },
  ];
}
