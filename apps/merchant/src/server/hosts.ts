/**
 * UN SUBDOMINIO POR AUDIENCIA (spec 0114 / ADR 0106), puro y sin red.
 *
 * Merchant sirve a las dos audiencias desde una sola app: el comercio en `business.` y el
 * cliente en `my.`. Una pagina pedida en el host equivocado responde 308 al host correcto
 * (mismo path y query). `src/proxy.ts` es el unico borde que llama a
 * {@link decideHostRoute}; las rutas que EMITEN una URL del cliente (pases de Wallet, QR del
 * afiche) usan {@link consumerOriginOr}.
 *
 * H1: sin `MERCHANT_ORIGIN` y `CONSUMER_ORIGIN` no se redirige nada — el codigo se puede
 * desplegar antes de tocar los dominios. H2: solo se redirige cuando el host ES uno de los
 * dos (`www`, `*.vercel.app` y `localhost` no se tocan). H3: `/api/*` nunca.
 */

export type HostRouteInput = {
  /** El header `host` tal cual llega (puede traer puerto y mayusculas). */
  host: string | null | undefined;
  pathname: string;
  /** `""` o `"?a=1"` — se copia tal cual al destino. */
  search: string;
  merchantOrigin: string | null | undefined;
  consumerOrigin: string | null | undefined;
};

export type HostRoute = { redirect: string } | null;

/** Paginas del cliente: `/wallet`, `/c/*`, `/enroll/*`, `/recover`. */
function isConsumerPage(pathname: string): boolean {
  return (
    pathname === "/wallet" ||
    pathname.startsWith("/wallet/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/enroll/") ||
    pathname === "/recover" ||
    pathname.startsWith("/recover/")
  );
}

/** Paginas del comercio: `/backoffice` y `/<locale>/business/*`. */
function isMerchantPage(pathname: string): boolean {
  return (
    pathname === "/backoffice" ||
    pathname.startsWith("/backoffice/") ||
    /^\/[^/]+\/business(?:\/|$)/.test(pathname)
  );
}

/** Lo que nunca se redirige: la API (H3), los assets de Next y los archivos con extension. */
function isNeverRouted(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    /\.[^/]+$/.test(pathname)
  );
}

/** Un origen sin barra final, o `null` si esta vacio o no es una URL. */
function normalizeOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/** El hostname de un header `host`: sin puerto y en minusculas (IPv6 entre corchetes incluido). */
function hostnameOf(host: string): string {
  const value = host.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end === -1 ? value : value.slice(0, end + 1);
  }
  const colon = value.indexOf(":");
  return colon === -1 ? value : value.slice(0, colon);
}

export function decideHostRoute(input: HostRouteInput): HostRoute {
  const merchant = normalizeOrigin(input.merchantOrigin);
  const consumer = normalizeOrigin(input.consumerOrigin);
  if (!merchant || !consumer || !input.host) return null; // H1
  const merchantHost = new URL(merchant).hostname;
  const consumerHost = new URL(consumer).hostname;
  // Los dos origenes en el mismo host redirigirian a si mismos: bucle. No se enruta.
  if (merchantHost === consumerHost) return null;

  const { pathname, search } = input;
  if (isNeverRouted(pathname)) return null;

  const host = hostnameOf(input.host);
  if (host === merchantHost && isConsumerPage(pathname)) {
    return { redirect: `${consumer}${pathname}${search}` };
  }
  if (host === consumerHost) {
    if (pathname === "/") return { redirect: `${consumer}/wallet${search}` }; // H4
    if (isMerchantPage(pathname)) {
      return { redirect: `${merchant}${pathname}${search}` };
    }
  }
  return null; // H2: `www`, `*.vercel.app`, `localhost` y todo lo demas
}

/**
 * El origen con el que se EMITE una URL del cliente (el `webServiceURL` y el link `/c/` de
 * un pase, el QR `/enroll` del afiche): `CONSUMER_ORIGIN` si esta cargado, si no el del
 * request. Asi un pase emitido con `www` se reemite con `my.` en su proxima descarga.
 */
export function consumerOriginOr(
  fallback: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return normalizeOrigin(env.CONSUMER_ORIGIN) ?? fallback;
}
