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
 *
 * LA TERCERA AUDIENCIA (spec 0218 / ADR 0140): el equipo del comercio en `staff.`
 * (`STAFF_ORIGIN`). Sin esa variable —o con un host igual al de otra audiencia, que haria
 * bucle— el host `staff.` no se trata distinto y todo sigue como con dos audiencias. En
 * `staff.` la portada se REESCRIBE (no se redirige: la URL queda `staff.…/`) a la pagina
 * interna del ingreso del equipo, {@link STAFF_ENTRY_PATH}.
 */

import { isSupportedLocale } from "../i18n/locales";

export type HostRouteInput = {
  /** El header `host` tal cual llega (puede traer puerto y mayusculas). */
  host: string | null | undefined;
  pathname: string;
  /** `""` o `"?a=1"` — se copia tal cual al destino. */
  search: string;
  merchantOrigin: string | null | undefined;
  consumerOrigin: string | null | undefined;
  /** Spec 0218: `STAFF_ORIGIN`. Opcional: sin ella, el comportamiento de dos audiencias. */
  staffOrigin?: string | null | undefined;
};

/** `redirect`: 308 a esa URL absoluta. `rewrite`: servir ese path (con su query) sin cambiar
 * la URL del navegador. `null`: seguir. */
export type HostRoute = { redirect: string } | { rewrite: string } | null;

/** La ruta INTERNA de la pantalla del ingreso del equipo (spec 0218): en `staff.` se sirve en
 * la portada; en `business.` se redirige a esa portada. */
export const STAFF_ENTRY_PATH = "/acceso-equipo";

/** La cabecera que lleva toda pagina del host del equipo (ADR 0140 §2: no indexable). */
export const STAFF_ROBOTS_TAG = "noindex, nofollow";

/** Paginas del cliente: `/wallet`, `/c/*`, `/enroll/*`. */
function isConsumerPage(pathname: string): boolean {
  return (
    pathname === "/wallet" ||
    pathname.startsWith("/wallet/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/enroll/")
  );
}

/** Paginas del comercio: `/backoffice` y `/<locale>/business/*`, SOLO con un locale real
 * (`supportedLocales`): un primer segmento cualquiera hacia que `/wallet/business` fuera
 * del cliente Y del comercio a la vez → bucle de 308 entre `business.` y `my.` (revisor 0114). */
function isMerchantPage(pathname: string): boolean {
  if (pathname === "/backoffice" || pathname.startsWith("/backoffice/"))
    return true;
  const [, locale, section] = pathname.split("/");
  return section === "business" && isSupportedLocale(locale ?? "");
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

/** `STAFF_ORIGIN` normalizado, o `null` si falta o si su host coincide con el de otra
 * audiencia (redirigir entre dos nombres del mismo host es un bucle). */
function staffOriginOf(
  staffOrigin: string | null | undefined,
  otherHosts: readonly string[],
): string | null {
  const staff = normalizeOrigin(staffOrigin);
  if (!staff) return null;
  return otherHosts.includes(new URL(staff).hostname) ? null : staff;
}

/** El ruteo del host `staff.` (spec 0218). `pathname` ya paso por {@link isNeverRouted}. */
function staffHostRoute(
  pathname: string,
  search: string,
  merchant: string,
  consumer: string,
): HostRoute {
  if (pathname === "/") return { rewrite: `${STAFF_ENTRY_PATH}${search}` };
  // El panel del equipo se sirve en `staff.`: su sesion queda atada a este host (ADR 0140 §4).
  if (pathname === "/backoffice" || pathname.startsWith("/backoffice/"))
    return null;
  if (isMerchantPage(pathname))
    return { redirect: `${merchant}${pathname}${search}` };
  if (isConsumerPage(pathname))
    return { redirect: `${consumer}${pathname}${search}` };
  return null;
}

export function decideHostRoute(input: HostRouteInput): HostRoute {
  const merchant = normalizeOrigin(input.merchantOrigin);
  const consumer = normalizeOrigin(input.consumerOrigin);
  if (!merchant || !consumer || !input.host) return null; // H1
  const merchantHost = new URL(merchant).hostname;
  const consumerHost = new URL(consumer).hostname;
  // Los dos origenes en el mismo host redirigirian a si mismos: bucle. No se enruta.
  if (merchantHost === consumerHost) return null;
  const staff = staffOriginOf(input.staffOrigin, [merchantHost, consumerHost]);

  const { pathname, search } = input;
  if (isNeverRouted(pathname)) return null;

  const host = hostnameOf(input.host);
  if (staff && host === new URL(staff).hostname) {
    return staffHostRoute(pathname, search, merchant, consumer);
  }
  if (host === merchantHost && staff && pathname === STAFF_ENTRY_PATH) {
    // El ingreso del equipo pedido en `business.` va a la portada de `staff.`, con su query
    // (`?cambiar-pin=1` de la compuerta del PIN tiene que llegar).
    return { redirect: `${staff}/${search}` };
  }
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
 * ¿El request llego al host del equipo? (spec 0218: `X-Robots-Tag` y `robots.txt`). Mismas
 * reglas que el ruteo: solo el host exacto de `STAFF_ORIGIN`, y nunca si ese host es el de
 * otra audiencia.
 */
export function isStaffHost(input: {
  host: string | null | undefined;
  staffOrigin: string | null | undefined;
  merchantOrigin?: string | null | undefined;
  consumerOrigin?: string | null | undefined;
}): boolean {
  if (!input.host) return false;
  const others = [input.merchantOrigin, input.consumerOrigin]
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin !== null)
    .map((origin) => new URL(origin).hostname);
  const staff = staffOriginOf(input.staffOrigin, others);
  return staff !== null && hostnameOf(input.host) === new URL(staff).hostname;
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
