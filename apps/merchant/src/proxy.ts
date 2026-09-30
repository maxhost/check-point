import { NextResponse, type NextRequest } from "next/server";
import { decideHostRoute } from "./server/hosts";

/**
 * Enrutamiento por host (spec 0114 / ADR 0106). La decision es de `decideHostRoute`
 * (pura); esto solo la conecta al request. Sin `MERCHANT_ORIGIN` y `CONSUMER_ORIGIN`
 * (H1) siempre sigue. Las env se leen en cada request (runtime Node, el default de
 * Proxy en Next 16), no en build.
 */
export function proxy(request: NextRequest) {
  const route = decideHostRoute({
    host: request.headers.get("host"),
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    merchantOrigin: process.env.MERCHANT_ORIGIN,
    consumerOrigin: process.env.CONSUMER_ORIGIN,
  });
  if (!route) return NextResponse.next();
  return NextResponse.redirect(route.redirect, 308);
}

export const config = {
  // Segundo guard de H3: `/api` nunca entra al proxy (`decideHostRoute` tambien lo excluye).
  // Tampoco los assets de Next ni los archivos con extension.
  matcher: ["/((?!api(?:/|$)|_next/|[^?]*\\.[^/?]+$).*)"],
};
