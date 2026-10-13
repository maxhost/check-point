import { NextResponse, type NextRequest } from "next/server";
import {
  STAFF_ROBOTS_TAG,
  decideHostRoute,
  isStaffHost,
} from "@mi-pasaporte/domain/server/hosts";

/**
 * Enrutamiento por host (spec 0114 / ADR 0106; tercera audiencia `staff.`, spec 0218 /
 * ADR 0140). La decision es de `decideHostRoute` (pura); esto solo la conecta al request. Sin
 * `MERCHANT_ORIGIN` y `CONSUMER_ORIGIN` (H1) siempre sigue. Las env se leen en cada request
 * (runtime Node, el default de Proxy en Next 16), no en build.
 *
 * El host del equipo NO se indexa (ADR 0140 §2): toda respuesta de pagina en `staff.` —tambien
 * la reescritura de la portada y los 308 hacia otra audiencia— lleva `X-Robots-Tag`. El
 * `robots.txt` por host vive en `app/robots.txt/route.ts` (este matcher no ve archivos).
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const origins = {
    merchantOrigin: process.env.MERCHANT_ORIGIN,
    consumerOrigin: process.env.CONSUMER_ORIGIN,
    staffOrigin: process.env.STAFF_ORIGIN,
  };
  const route = decideHostRoute({
    host,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    ...origins,
  });
  const response = !route
    ? NextResponse.next()
    : "rewrite" in route
      ? NextResponse.rewrite(new URL(route.rewrite, request.url))
      : NextResponse.redirect(route.redirect, 308);
  if (isStaffHost({ host, ...origins })) {
    response.headers.set("X-Robots-Tag", STAFF_ROBOTS_TAG);
  }
  return response;
}

export const config = {
  // Segundo guard de H3: `/api` nunca entra al proxy (`decideHostRoute` tambien lo excluye).
  // Tampoco los assets de Next ni los archivos con extension.
  matcher: ["/((?!api(?:/|$)|_next/|[^?]*\\.[^/?]+$).*)"],
};
