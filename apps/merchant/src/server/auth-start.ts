import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "./schema";

/**
 * Spec 0067 §2 — la decision de la PANTALLA 1 del wizard: el owner escribe su email y el
 * servidor elige entre **abrir sesion en el acto** (email desconocido) y **mandar un link
 * magico** (email conocido).
 *
 * **Por que el email conocido NO abre sesion**, que es el invariante portante de este
 * archivo: sin contraseña, escribir el email de otro merchant le entregaria el negocio. Lo
 * confirmo el owner el 2026-09-16 (*«email existente: exacto no abre sesion en pantalla 1,
 * manda magic link, sin contraseña»*). La spec DECLARA que el endpoint es, por lo tanto, un
 * oraculo de existencia de cuenta —el flag `sent` lo dice— y lo compensa con el rate limit
 * por IP de abajo.
 *
 * Todo lo que toca la sesion vive en `merchant-session.ts`, que ya usa el login del staff:
 * no se reimplementa la firma de la cookie.
 */
export class AuthStartError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthStartError";
  }
}

/**
 * Limites del `start`, contados desde `merchant_auth.auth_start_attempt` (o sea desde la
 * base, no desde memoria: ver el docblock del esquema).
 *
 * `ipPerHour` es el que pide la spec §2. Los dos por email existen porque `start` tambien
 * MANDA MAIL: sin ellos, una sola IP dentro del cupo alcanza para inundar un buzon ajeno.
 * Son deliberadamente holgados — el limite tiene que frenar el abuso, no el alta de un
 * comercio que se equivoco tipeando.
 */
export const START_RATE_LIMITS = {
  ipPerHour: 20,
  emailPerHour: 5,
  emailPerDay: 10,
} as const;

/** SHA-256 del primer hop reenviado; null cuando ninguno expuso una direccion. */
export function hashClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "";
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * El dominio que `staff-create.ts` le acuña a cada integrante. **RFC 2606 §2 lo reserva para
 * que NUNCA resuelva**, asi que ningun MTA puede entregarle nada.
 *
 * Vive aca, y no junto a quien lo acuña, porque la regla que sostiene es de AUTH: *a esta
 * direccion no se le pide una entrega jamas*. `staff-create.ts` importa esta constante en vez
 * de repetir la cadena — dos literales en dos archivos es exactamente como se separan.
 */
export const UNDELIVERABLE_EMAIL_DOMAIN = "staff.invalid";

/**
 * Un email al que **no se le puede mandar nada**, y por eso tampoco se le gasta cupo.
 *
 * No alcanza con `normalizeEmail`: `staff-abc123@staff.invalid` **pasa** su forma —tiene `@`,
 * tiene punto— y eso hacia que `verify-email` con una sesion de integrante contestara 200,
 * emitiera un token de link magico de verdad, consumiera cupo del mismo balde que los owners
 * necesitan para entrar desde esa IP, y le pidiera al proveedor que entregara a un TLD que no
 * resuelve. Con `EMAIL_PROVIDER=console` no se nota; con un proveedor real es un hard bounce,
 * y la reputacion del remitente es el activo del que depende un producto cuyo login ENTERO son
 * links magicos. Lo cazo un revisor independiente (spec 0067, paso 3).
 *
 * Se corta por el dominio y no por el `role` de la membresia a proposito: no agrega una
 * consulta, y no tiene el caso borde del owner recien creado por `start`, que **todavia no
 * tiene membresia** y con un chequeo de rol habria que dejar pasar igual.
 */
export function isUndeliverableEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${UNDELIVERABLE_EMAIL_DOMAIN}`);
}

/** Minusculas + trim. Una forma invalida es 400: no dice nada de ninguna cuenta. */
export function normalizeEmail(raw: unknown): string {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AuthStartError(400, "invalid_email", "Ingresá un email válido.");
  return email;
}

/**
 * Cuenta los intentos previos y tira 429 si alguno de los tres cupos esta lleno. El conteo
 * sale de la base para que sobreviva al proceso y valga entre instancias de lambda.
 *
 * `count(*)::int`, no `count(*)` pelado: el driver devuelve `bigint` como STRING y el
 * generico de `db.execute<T>` es una asercion, no un chequeo — una comparacion contra el
 * umbral se decidiria por orden lexicografico.
 */
export async function assertStartWithinLimits(input: {
  email: string;
  ipHash: string | null;
}): Promise<void> {
  const counts = await getDb().execute<{
    email_hour: number;
    email_day: number;
    ip_hour: number;
  }>(
    sql`SELECT
          count(*) FILTER (
            WHERE email = ${input.email} AND created_at > now() - interval '1 hour'
          )::int AS email_hour,
          count(*) FILTER (
            WHERE email = ${input.email} AND created_at > now() - interval '1 day'
          )::int AS email_day,
          count(*) FILTER (
            WHERE ip_hash IS NOT NULL AND ip_hash = ${input.ipHash}
              AND created_at > now() - interval '1 hour'
          )::int AS ip_hour
        FROM merchant_auth.auth_start_attempt
        WHERE created_at > now() - interval '1 day'`,
  );
  const row = counts.rows[0];
  if (
    Number(row?.ip_hour ?? 0) >= START_RATE_LIMITS.ipPerHour ||
    Number(row?.email_hour ?? 0) >= START_RATE_LIMITS.emailPerHour ||
    Number(row?.email_day ?? 0) >= START_RATE_LIMITS.emailPerDay
  )
    throw new AuthStartError(
      429,
      "rate_limited",
      "Demasiados intentos. Probá de nuevo más tarde.",
    );
}

/** Deja el intento anotado ANTES de decidir la rama: las dos consumen cupo igual. */
export async function recordStartAttempt(input: {
  email: string;
  ipHash: string | null;
}): Promise<void> {
  await getDb().execute(
    sql`INSERT INTO merchant_auth.auth_start_attempt (email, ip_hash)
        VALUES (${input.email}, ${input.ipHash})`,
  );
}

/** El `user.id` de ese email, o null. `lower(email)` porque el unico no es funcional. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const found = await getDb().execute<{ id: string }>(
    sql`SELECT id FROM merchant_auth."user" WHERE lower(email) = ${email} LIMIT 1`,
  );
  return found.rows[0]?.id ?? null;
}

/**
 * Crea la cuenta del owner **sin fila en `merchant_auth.account`**: no hay contraseña que
 * guardar y `emailAndPassword` esta apagado, asi que no existe credencial que verificar.
 *
 * `emailVerified: false` a proposito: el wizard se completa sin verificar y lo que bloquea
 * el gate de `requireBackofficeSession` es todo lo POSTERIOR (spec §3 / ADR 0070 §11).
 *
 * El `name` queda vacio: la pantalla 1 pide solo el email (ADR 0070 §1) y el nombre del
 * comercio llega en la pantalla 2.
 */
export async function createOwnerUser(email: string): Promise<string> {
  const userId = randomUUID();
  const now = new Date();
  await getDb().insert(users).values({
    id: userId,
    name: "",
    email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  return userId;
}
