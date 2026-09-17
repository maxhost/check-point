import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../../server/auth";

export const dynamic = "force-dynamic";

/** Adonde cae el owner cuando el link sirvio, y adonde cuando no. */
const OK_DESTINATION = "/backoffice";
const FAILED_DESTINATION = "/?e=magic_link_invalid";

/**
 * GET /api/merchant/auth/magic-link?token=… — el CONSUMO del link magico, por ruta propia
 * (spec 0067 §2).
 *
 * Por que ruta propia y no el endpoint del plugin: `/sign-in/magic-link` y
 * `/magic-link/verify` estan en `disabledPaths` (`server/auth.ts`), porque el catch-all
 * `/api/auth/[...all]` los publicaria salteando nuestro rate limit y nuestro registro de
 * intentos. `disabledPaths` **no** afecta a `auth.api.*`, que es lo que se llama acá.
 *
 * Es un GET porque el destino lo escribe el propio mail y no hay UI todavia que pueda
 * postear el token. **Consecuencia declarada:** un escaner de correo que siga el enlace
 * consume el token (vale una sola vez) y el owner recibe el rebote de link invalido; es
 * inherente a los links magicos, no un descuido.
 *
 * El consumo tambien VERIFICA el email: better-auth 1.6.26 pone `emailVerified: true` al
 * consumir el token (`plugins/magic-link/index.mjs`) y antes revoca lo que la cuenta
 * hubiera acumulado sin prueba del buzon (`revokeUnprovenAccountAccess`). O sea que este
 * enlace es el primer paso del onboarding del ADR 0070 §11 y lo que abre el gate de la §3.
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §6.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return bounce(FAILED_DESTINATION);

  let verified: Response;
  try {
    // Sin `callbackURL`: asi el endpoint contesta JSON + `set-cookie` en vez de armar su
    // propio redirect, y el destino lo decide ESTA ruta. Un token invalido o vencido
    // responde con el redirect de error del plugin (no 200), que se normaliza abajo al
    // mismo codigo de rebote que usa el resto del producto.
    verified = await getMerchantAuth().api.magicLinkVerify({
      query: { token },
      headers: request.headers,
      asResponse: true,
    });
  } catch (error) {
    console.error("merchant_magic_link_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return bounce(FAILED_DESTINATION);
  }

  const cookie = verified.headers.get("set-cookie");
  if (verified.status !== 200 || !cookie) return bounce(FAILED_DESTINATION);
  return bounce(OK_DESTINATION, cookie);
}

/**
 * 303 y no 302: el navegador tiene que llegar al destino con un GET limpio. La cookie viaja
 * en el mismo rebote —es un `SameSite=Lax` sobre una navegacion de primer nivel, o sea que
 * el browser la acepta— asi que el owner aterriza ya logueado.
 */
function bounce(destination: string, cookie?: string): NextResponse {
  const headers = new Headers({ location: destination });
  if (cookie) headers.set("set-cookie", cookie);
  return new NextResponse(null, { status: 303, headers });
}
