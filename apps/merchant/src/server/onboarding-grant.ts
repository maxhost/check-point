import { and, eq, isNotNull, sql } from "drizzle-orm";
import { sessions } from "./schema";
import type { getDb } from "./db";

/**
 * Spec 0077 §4 / ADR 0076 §2 — EL PERMISO DE ALTA, su decisión y su caducidad.
 *
 * **Módulo HOJA a propósito**: la decisión tiene que ser importable desde
 * `loyalty-program.ts` sin arrastrar `next/server` ni better-auth. Es la misma razón por la
 * que `business-status.ts` existe separado de `api-owner.ts`. El único import de `./db` es
 * `import type` — se borra en compilación, así que en runtime este módulo no abre una
 * conexión ni exige `DATABASE_URL`.
 */

/** Tope duro desde que se crea la cuenta (ADR 0076 §4.3). Vive acá y no como literal en la
 * ruta: `POST /api/merchant/auth/start` lo importa. */
export const ONBOARDING_GRANT_MINUTES = 60;

/** Tope tras completar el alta (ADR 0076 §4.2, decisión del owner). */
export const ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES = 5;

/** Lo que el writer necesita saber del que escribe, y nada más. Es el 3er argumento
 * OBLIGATORIO de `saveProgram`: obligatorio para que el typecheck fuerce a cada puerta
 * presente y futura a declarar con qué autorización escribe. */
export type ProgramCaller = {
  emailVerified: boolean;
  onboardingGrantActive: boolean;
  /**
   * Spec 0086 §10 (enmienda 2026-09-21) — **¿el caller es un INTEGRANTE?**
   *
   * Existe porque el gate de email de este writer volvia a imponer `emailVerified`
   * **despues** de que el paso 4 de `requireApiPermission` exceptuo al staff **a proposito**
   * (ADR 0079 §5): el integrante tiene un email sintetico `@staff.invalid` que nunca se
   * entrega y **ninguna accion con la que verificar nada**, asi que un gate que lo alcanzara
   * dejaria su superficie muerta para siempre. Sin este dato, un staff con `loyalty` pasaba
   * la puerta y moria en el dominio con `email_not_verified` — el bloqueo que la enmienda
   * cierra.
   *
   * **OPCIONAL y fail-CLOSED**: ausente se lee como `false`, o sea el gate se aplica, que es
   * el comportamiento de siempre para toda puerta que no lo declare.
   */
  isStaff?: boolean;
};

/**
 * PURA. El permiso corre si la sesión lo tiene VIGENTE **y** el email NO está verificado.
 *
 * Los tres cortes del ADR 0076 §4 caen todos acá sin escribir nada:
 *
 * | Corte | Cómo se aplica |
 * |---|---|
 * | email verificado | `emailVerified === true` → `false`, evaluado en la LECTURA |
 * | 60 min desde la cuenta | el instante que `auth/start` escribió ya venció |
 * | 5 min tras el alta completa | el acortado de `shortenOnboardingGrant` ya lo adelantó |
 *
 * **Fail-closed:** ausente, `null` o fecha inválida → `false`. Que `emailVerified` no sea
 * exactamente `true` cuenta como NO verificado —que es lo que *habilita* el permiso—, pero
 * eso nunca abre nada por sí solo: sin instante vigente el permiso no corre. El `!== true`
 * de `requireApiOwner` (paso 3) no se toca.
 */
export function onboardingGrantActive(input: {
  onboardingGrantUntil: Date | string | null | undefined;
  emailVerified: boolean | null | undefined;
  now?: Date;
}): boolean {
  if (input.emailVerified === true) return false;
  const until = input.onboardingGrantUntil;
  if (until === null || until === undefined) return false;
  const at = until instanceof Date ? until : new Date(until);
  const ms = at.getTime();
  if (Number.isNaN(ms)) return false;
  return ms > (input.now ?? new Date()).getTime();
}

/**
 * EL INVARIANTE CREAR ≠ EDITAR (spec 0077 §5, ADR 0076 §1), puro y fuera del writer para
 * que se pueda medir sin base.
 *
 * ```
 * si (el programa existe)  → es EDICION → exige email verificado O permiso de alta
 * si (no existe)           → es CREACION → permitida SIEMPRE
 * ```
 *
 * **Crear siempre se permite** y no depende del permiso: es la decisión del owner del ADR
 * 0070 §11 («para el alta no pedimos verificación»), así que una cuenta sin verificar con el
 * permiso ya caducado todavía puede crear su primer programa.
 */
export function programEditDenied(
  input: ProgramCaller & { isEdit: boolean },
): { status: 403; code: "email_not_verified"; message: string } | null {
  if (!input.isEdit) return null;
  // Spec 0086 §10: el paso 4 de la escalera ya decidio EXCEPTUAR al staff, y re-imponer el
  // gate aca seria deshacer esa decision una capa mas abajo. `=== true` y no `!`: un
  // `undefined` deja el gate PUESTO (fail-closed en el dato).
  if (input.isStaff === true) return null;
  if (input.emailVerified || input.onboardingGrantActive) return null;
  return {
    status: 403,
    code: "email_not_verified",
    message: "Verificá tu email para editar el programa.",
  };
}

/**
 * El acortado del corte (2) — spec 0077 §5. Devuelve el statement para que el writer lo meta
 * en **la misma transacción** que crea el programa: si el insert se cae, la ventana no se
 * toca.
 *
 * **`least(...)` y no una asignación**: preserva la monotonía de §1. Si al usuario le
 * quedaban 2 minutos del tope de 60, completar el alta NO se los extiende a 5.
 *
 * Se acortan **todas** las sesiones del usuario, no sólo la que escribió: el permiso es del
 * alta, no del navegador, y dejar viva la de otra pestaña reabriría la ventana.
 */
export function shortenOnboardingGrant(
  db: ReturnType<typeof getDb>,
  userId: string,
) {
  return db
    .update(sessions)
    .set({
      onboardingGrantUntil: sql`least(${sessions.onboardingGrantUntil}, now() + make_interval(mins => ${ONBOARDING_GRANT_AFTER_COMPLETION_MINUTES}))`,
    })
    .where(
      and(
        eq(sessions.userId, userId),
        isNotNull(sessions.onboardingGrantUntil),
      ),
    );
}
