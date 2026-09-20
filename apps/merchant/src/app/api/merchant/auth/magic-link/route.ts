import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../../server/auth";
import { getDb } from "../../../../../server/db";
import {
  businesses,
  memberships,
  sessions,
} from "../../../../../server/schema";

export const dynamic = "force-dynamic";

/** Adonde cae el owner cuando el link sirvio, y adonde cuando no. */
const OK_DESTINATION = "/backoffice";
const FAILED_DESTINATION = "/?e=magic_link_invalid";
/** Spec 0072 §D4: el negocio esta CERRADO, asi que no se emite sesion. Mismo canal de
 * codigos de rebote que `staff_disabled` (`server/auth-guards.ts`). **`email_not_verified` ya
 * NO viaja por este canal** (spec 0082): el guard dejo de rebotar al owner sin verificar, y
 * ese motivo existe unicamente como 403 de API. */
const CLOSED_DESTINATION = "/?e=business_closed";

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

  /**
   * EL CORTE DE `closed` (spec 0072 §D4), y va ACA y no en `auth/start`, que es deliberado:
   * `start` solo toca `merchant_auth.user` y no resuelve negocio, asi que gatear ahi seria
   * una consulta nueva — y ademas el owner de un negocio `suspended` **si tiene que entrar**,
   * para ver el motivo. **El corte va donde se CREA la sesion.**
   *
   * `magicLinkVerify` ya creo la sesion en la base antes de contestar
   * (`internalAdapter.createSession`, `plugins/magic-link/index.mjs`), asi que no alcanza con
   * no reenviar la cookie: hay que REVOCARLA, con el mismo `DELETE` en forma y alcance que el
   * de `requireBackofficeSession` y `setStaffStatus`. Sin eso quedaria una sesion viva en la
   * base — sin cookie hoy, pero viva — y esta ruta no agrega mecanismos de revocacion nuevos.
   *
   * Un owner SIN negocio (recien registrado, todavia sin pasar el wizard) entra normal: no
   * hay fila que consultar y el alta es justamente lo que viene despues.
   */
  const userId = await verifiedUserId(verified);
  if (userId && (await businessIsClosed(userId))) {
    await getDb().delete(sessions).where(eq(sessions.userId, userId));
    return bounce(CLOSED_DESTINATION);
  }
  return bounce(OK_DESTINATION, cookie);
}

/** El `user.id` del cuerpo JSON del verify. Sin `callbackURL` el plugin contesta
 * `{ token, user, session }`; un cuerpo inesperado devuelve `null` y **no** bloquea el
 * login — un cambio de forma de better-auth no puede dejar a todos afuera. */
async function verifiedUserId(verified: Response): Promise<string | null> {
  try {
    const body = (await verified.clone().json()) as {
      user?: { id?: unknown };
    } | null;
    const id = body?.user?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/**
 * Si «su negocio» esta `closed`. El criterio de «su negocio» es **la membresia mas vieja**, el
 * mismo de `requireBackofficeSession` (`auth-guards.ts:106`) y de `ownerContext`
 * (`staff.ts:88`), y por eso el `orderBy` es OBLIGATORIO y no cosmetico: un `limit(1)` sin
 * orden es **no determinista** —Postgres puede devolver cualquiera de las filas— asi que sin el
 * este guard abriria o cerraria la sesion al azar en cuanto un user tenga dos membresias. El
 * docblock original afirmaba el orden y la consulta no lo tenia (cazado por el revisor de la
 * 0072).
 *
 * **Divergencia que queda declarada, no cerrada:** aca se filtra
 * `memberships.status='active'` y `requireBackofficeSession` **no** lo filtra. Con un solo
 * negocio por usuario —lo que hoy garantiza el `409` de `api/onboarding/business`— las dos
 * consultas coinciden; el dia que un user tenga dos, hay que unificarlas en un solo
 * resolvedor. Es la misma familia que la divergencia `asc`/`desc` de `loyalty-program.ts:66`.
 */
async function businessIsClosed(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ status: businesses.status })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(eq(memberships.userId, userId), eq(memberships.status, "active")),
    )
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return row?.status === "closed";
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
