/**
 * Spec 0067 §4 / ADR 0070 §13 — la maquina de estados del bloqueo escalado del PIN del
 * staff, como **funcion pura**: sin base, sin reloj propio, sin hash.
 *
 * Por que vive separada del `UPDATE` que la persiste: los numeros son una decision del
 * OWNER y son lo unico que hay que poder mutar para saber si el oraculo muerde. Metida
 * adentro del SQL, probarlos exigiria Neon y una mutacion se volveria indistinguible de
 * un problema de conexion (protocolo de verificacion §3).
 *
 * El resto del dominio del PIN —generacion, hash, verificacion y el `UPDATE` atomico que
 * persiste este calculo— vive abajo, en el mismo archivo, porque comparte la tabla
 * `ESCALATION`: los umbrales del SQL se GENERAN de ella (ver `escalationCase`), asi que
 * los numeros del owner siguen estando en un solo lugar.
 */

import { randomInt } from "node:crypto";
import { sql } from "drizzle-orm";
import { getMerchantAuth } from "./auth";
import { getDb } from "./db";

/** La fila de `core.staff_pin_lockout`, keyeada por `(business_id, user_id)`. */
export type StaffPinLockoutState = {
  failedCount: number;
  /** 0, 1, 2, 3. Define el umbral del proximo bloqueo y cuanto dura. */
  stage: number;
  lockedUntil: Date | null;
};

/**
 * La tabla de la spec §4, tal como la confirmo el owner el 2026-09-16:
 *
 * | stage | fallos que lo disparan | bloqueo | stage resultante |
 * |---|---|---|---|
 * | 0 | 5 | 15 min | 1 |
 * | 1 | 3 | 1 h  | 2 |
 * | 2 | 1 | 24 h | 3 |
 * | 3 | 1 | 24 h | 3 |
 *
 * No se exporta: un test que la leyera estaria aseverando la tabla contra si misma, y una
 * mutacion del umbral quedaria verde. Los umbrales se prueban por COMPORTAMIENTO.
 */
const ESCALATION = [
  { threshold: 5, lockMs: 15 * 60_000, nextStage: 1 },
  { threshold: 3, lockMs: 60 * 60_000, nextStage: 2 },
  { threshold: 1, lockMs: 24 * 60 * 60_000, nextStage: 3 },
  { threshold: 1, lockMs: 24 * 60 * 60_000, nextStage: 3 },
] as const;

const MAX_STAGE = ESCALATION.length - 1;

/** Un `stage` fuera de rango (fila vieja, escritura ajena) se trata como el mas severo. */
function rowFor(stage: number) {
  const index = Math.min(Math.max(Math.trunc(stage), 0), MAX_STAGE);
  return ESCALATION[index];
}

function isLocked(state: StaffPinLockoutState, now: Date): boolean {
  return (
    state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime()
  );
}

/**
 * Calcula el estado siguiente del bloqueo.
 *
 * - **Bloqueado (`locked_until > now`): el estado no se mueve**, valga lo que valga `ok`.
 *   La ruta responde 429 sin evaluar el PIN, asi que un intento durante el bloqueo no
 *   consume nada ni lo alarga — y un PIN correcto tampoco lo levanta (spec §4).
 * - **Exito**: `failed_count`, `stage` y `locked_until` vuelven a cero/null.
 * - **Fallo**: incrementa; al llegar al umbral del `stage` actual aplica el bloqueo, sube
 *   de `stage` y reinicia el contador, que es lo que hace que el siguiente tramo pida
 *   menos fallos que el anterior.
 */
export function nextLockout(
  state: StaffPinLockoutState,
  ok: boolean,
  now: Date,
): StaffPinLockoutState {
  if (isLocked(state, now)) return state;

  if (ok) return { failedCount: 0, stage: 0, lockedUntil: null };

  const failedCount = state.failedCount + 1;
  const row = rowFor(state.stage);
  if (failedCount < row.threshold) {
    // `locked_until` queda en null y no en su valor vencido: un bloqueo expirado no es
    // informacion, y dejarlo obligaria a todo lector a recomparar contra el reloj.
    return { failedCount, stage: state.stage, lockedUntil: null };
  }

  return {
    failedCount: 0,
    stage: row.nextStage,
    lockedUntil: new Date(now.getTime() + row.lockMs),
  };
}

/* ------------------------------------------------------------------------- *
 * El PIN: generacion, hash y verificacion.
 * ------------------------------------------------------------------------- */

/** 6 digitos, decision del owner (ADR 0070 §13). */
export const PIN_LENGTH = 6;

const PIN_SHAPE = /^[0-9]{6}$/;

/** ¿Tiene forma de PIN? Lo usan las rutas antes de gastar un hash. */
export function isValidPin(value: unknown): value is string {
  return typeof value === "string" && PIN_SHAPE.test(value);
}

/**
 * PIN nuevo de 6 digitos. `randomInt` de `node:crypto` (CSPRNG, sin sesgo modulo), no
 * `Math.random`: es la credencial entera del staff — no hay contraseña detras.
 * Se permite `000000`: recortar el espacio para que "parezca aleatorio" lo achica.
 */
export function generatePin(): string {
  return String(randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, "0");
}

/**
 * Hash del PIN con el hasher de better-auth (`ctx.password.hash`), que es el mismo que
 * protegia las contraseñas: la spec §4 es explicita en que **no se introduce un algoritmo
 * nuevo**. Su resistencia a fuerza bruta offline se hereda y no se vuelve a medir
 * (declarado en la spec, «Lo que queda afuera»).
 */
export async function hashPin(pin: string): Promise<string> {
  const ctx = await getMerchantAuth().$context;
  return ctx.password.hash(pin);
}

/**
 * ¿El PIN corresponde al hash? **Nunca tira.**
 *
 * Medido contra `better-auth/crypto`: verificar cualquier PIN contra un valor que no es un
 * hash —por ejemplo el centinela `'legacy-sin-pin'` con el que la migracion 0032 rellena
 * las membresias de staff heredadas— tira `Error: Invalid password hash`. Ese throw
 * llegaria a la ruta como un **500**, que es peor que un 401 por dos motivos: distingue a
 * esas filas de las demas (oraculo de existencia) y convierte un fallo de credencial en un
 * error del servidor. Aca se traduce a `false`, o sea **fail-closed**: la fila centinela no
 * autentica jamas y el intento cuenta como fallido, igual que cualquier otro.
 */
export async function verifyPin(hash: string, pin: string): Promise<boolean> {
  const ctx = await getMerchantAuth().$context;
  try {
    return await ctx.password.verify({ hash, password: pin });
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------------- *
 * El bloqueo, persistido en UN solo statement.
 * ------------------------------------------------------------------------- */

/**
 * Renderiza una columna de `ESCALATION` como un `CASE` sobre el `stage` de la fila viva.
 * Es lo que evita que los numeros del owner queden escritos dos veces: el SQL no los
 * conoce, los recibe de la misma tabla que `nextLockout`. El `else` toma la ultima fila,
 * que es el clamp de `rowFor` — un `stage` fuera de rango se trata como el mas severo.
 */
function escalationCase(pick: (row: (typeof ESCALATION)[number]) => number) {
  const whens = ESCALATION.map(
    (row, index) => sql`when ${index}::int then ${pick(row)}::int`,
  );
  return sql`(case l.stage ${sql.join(whens, sql` `)} else ${pick(
    ESCALATION[MAX_STAGE],
  )}::int end)`;
}

/** neon-http devuelve `{ rows }`; el builder devuelve un array. Normaliza las dos. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/**
 * Registra UN intento de PIN y devuelve el estado resultante, en **un solo statement**
 * con el guard adentro (spec §4: nunca read-then-write). Es el patron de `persistGrant`:
 * la decision no se toma en TypeScript con una lectura previa que otra request puede
 * invalidar entre medio, se toma en el `UPDATE` mismo.
 *
 * - La fila puede no existir (primer intento del integrante): el `insert` la crea con los
 *   valores que devuelve la **funcion pura** `nextLockout` sobre el estado cero.
 * - Si ya existe, el `on conflict do update` decide con la fila viva (`l.*`), en el mismo
 *   orden que `nextLockout`: bloqueado → no se mueve nada; exito → todo a cero; fallo →
 *   incrementa y, al llegar al umbral de SU `stage`, bloquea y escala.
 * - **Estando bloqueado el estado no se toca aunque `ok` sea `true`**: es lo que hace que
 *   un PIN correcto durante el bloqueo no lo levante ni lo alargue.
 *
 * Que la logica viva en dos lenguajes (TS puro para el estado cero y los tests, SQL para
 * la persistencia) es deliberado y tiene oraculo propio: el recorrido 5 → 15 min, 3 → 1 h
 * de `staff-pin.neon.integration.test.ts` corre contra la base, no contra `nextLockout`.
 */
export async function registerPinAttempt(
  businessId: string,
  userId: string,
  ok: boolean,
  now: Date,
): Promise<StaffPinLockoutState> {
  const seed = nextLockout(
    { failedCount: 0, stage: 0, lockedUntil: null },
    ok,
    now,
  );
  const threshold = escalationCase((row) => row.threshold);
  const nextStage = escalationCase((row) => row.nextStage);
  const lockMs = escalationCase((row) => row.lockMs);
  const locked = sql`(l.locked_until is not null and l.locked_until > ${now.toISOString()}::timestamptz)`;
  const below = sql`(l.failed_count + 1 < ${threshold})`;

  const result = await getDb().execute(sql`
    INSERT INTO core.staff_pin_lockout AS l
      (business_id, user_id, failed_count, stage, locked_until)
    VALUES (${businessId}::uuid, ${userId}::text, ${seed.failedCount}::int,
            ${seed.stage}::int, ${seed.lockedUntil?.toISOString() ?? null}::timestamptz)
    ON CONFLICT (business_id, user_id) DO UPDATE SET
      failed_count = CASE
        WHEN ${locked} THEN l.failed_count
        WHEN ${ok}::boolean THEN 0
        WHEN ${below} THEN l.failed_count + 1
        ELSE 0 END,
      stage = CASE
        WHEN ${locked} THEN l.stage
        WHEN ${ok}::boolean THEN 0
        WHEN ${below} THEN l.stage
        ELSE ${nextStage} END,
      locked_until = CASE
        WHEN ${locked} THEN l.locked_until
        WHEN ${ok}::boolean THEN NULL
        WHEN ${below} THEN NULL
        ELSE ${now.toISOString()}::timestamptz
             + ${lockMs} * interval '1 millisecond' END
    RETURNING failed_count, stage, locked_until
  `);

  const [row] = rowsOf(result);
  // `execute` devuelve los valores CRUDOS del driver: un `timestamptz` llega como string,
  // no como `Date` (gotcha del repo). La conversion va aca y no en el llamador.
  const lockedUntil = row?.locked_until;
  return {
    failedCount: Number(row?.failed_count ?? 0),
    stage: Number(row?.stage ?? 0),
    lockedUntil:
      typeof lockedUntil === "string"
        ? new Date(lockedUntil)
        : lockedUntil instanceof Date
          ? lockedUntil
          : null,
  };
}

/** ¿Hay un bloqueo vivo en este estado? La ruta contesta 429 cuando da `true`. */
export function lockedFor(
  state: StaffPinLockoutState,
  now: Date,
): number | null {
  if (!state.lockedUntil) return null;
  const ms = state.lockedUntil.getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 1000) : null;
}
