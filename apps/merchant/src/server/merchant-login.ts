import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships, sessions } from "@mi-pasaporte/db/schema";

/**
 * Lo que comparten las dos puertas del owner que CREAN una sesion: el link magico
 * (`GET /api/merchant/auth/magic-link`, alta y verificacion) y el codigo
 * (`POST /api/merchant/auth/login/verify`, spec 0202 / ADR 0137). Las dos reciben una
 * respuesta de better-auth que ya creo la sesion, y las dos tienen que aplicar el mismo
 * corte de negocio `closed` (spec 0072 §D4) y elegir el mismo destino.
 */

export const OK_DESTINATION = "/backoffice";
export const ONBOARDING_DESTINATION = "/es/business/onboarding";

export type LoginOutcome =
  { kind: "closed" } | { kind: "open"; destination: string };

/**
 * EL CORTE DE `closed` (spec 0072 §D4) va donde se CREA la sesion: el owner de un negocio
 * `suspended` si tiene que entrar, para ver el motivo; el de uno `closed`, no.
 *
 * better-auth ya creo la sesion en la base antes de contestar, asi que no alcanza con no
 * reenviar la cookie: hay que REVOCARLA, con el mismo `DELETE` en forma y alcance que el de
 * `requireBackofficeSession` y `setStaffStatus`.
 *
 * Un usuario SIN negocio hoy no existe: el alta crea cuenta y negocio en un mismo `db.batch`
 * (spec 0155). Si apareciera, va al alta y el guard de `/backoffice` le cierra la sesion
 * (spec 0166).
 */
export async function settleOwnerLogin(
  verified: Response,
): Promise<LoginOutcome> {
  const userId = await verifiedUserId(verified);
  const status = userId ? await businessStatus(userId) : null;
  if (userId && status === "closed") {
    await getDb().delete(sessions).where(eq(sessions.userId, userId));
    return { kind: "closed" };
  }
  return {
    kind: "open",
    destination: userId && !status ? ONBOARDING_DESTINATION : OK_DESTINATION,
  };
}

/** El `user.id` del cuerpo JSON de better-auth (`{ token, user, ... }`). Un cuerpo inesperado
 * devuelve `null` y **no** bloquea el login — un cambio de forma de better-auth no puede dejar
 * a todos afuera. */
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
 * este guard abriria o cerraria la sesion al azar en cuanto un user tenga dos membresias
 * (cazado por el revisor de la 0072).
 *
 * **Divergencia que queda declarada, no cerrada:** aca se filtra
 * `memberships.status='active'` y `requireBackofficeSession` **no** lo filtra. Con un solo
 * negocio por usuario —lo que hoy garantiza `api/onboarding/signup` (spec 0155)— las dos
 * consultas coinciden; el dia que un user tenga dos, hay que unificarlas en un solo
 * resolvedor.
 */
async function businessStatus(userId: string) {
  const [row] = await getDb()
    .select({ status: businesses.status })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(eq(memberships.userId, userId), eq(memberships.status, "active")),
    )
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return row?.status ?? null;
}

/**
 * Spec 0202 §D4 — EL TOPE DE CODIGOS EQUIVOCADOS: 10 por email en una ventana movil de 24 h
 * (owner 2026-10-11). Se guardan en la tabla generica de verificaciones de better-auth con un
 * prefijo propio, asi no hace falta migracion; el prefijo no choca con los de better-auth
 * (`sign-in-otp-…` del plugin, tokens del link). better-auth nunca lee estas filas.
 *
 * Costo aceptado por el owner (ADR 0137): quien conozca el email puede dejar al owner 24 h
 * sin entrar tipeando 10 codigos equivocados.
 */
export const LOGIN_CODE_FAILURE_LIMIT = 10;
const FAILURE_PREFIX = "login-code-failure-";

export async function loginCodeFailuresExhausted(
  email: string,
): Promise<boolean> {
  const counted = await getDb().execute<{ failures: number }>(
    sql`SELECT count(*)::int AS failures
        FROM merchant_auth.verification
        WHERE identifier = ${FAILURE_PREFIX + email} AND expires_at > now()`,
  );
  return Number(counted.rows[0]?.failures ?? 0) >= LOGIN_CODE_FAILURE_LIMIT;
}

export async function recordLoginCodeFailure(email: string): Promise<void> {
  await getDb().execute(
    sql`INSERT INTO merchant_auth.verification
          (id, identifier, value, expires_at, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${FAILURE_PREFIX + email}, 'failure',
                now() + interval '24 hours', now(), now())`,
  );
}
