/**
 * Quien escribe el programa y si puede EDITARLO (spec 0077 §5, ADR 0076 §1; spec 0156).
 *
 * **Modulo HOJA a proposito**: la decision tiene que ser importable desde
 * `loyalty-program.ts` sin arrastrar `next/server` ni better-auth.
 *
 * Spec 0156: el permiso de alta (una ventana de 60 min que dejaba editar sin email
 * verificado, ADR 0076 §2) se borro al salir el programa del wizard (ADR 0121). Editar exige
 * email verificado sin excepcion temporal.
 */

/** Lo que el writer necesita saber del que escribe, y nada más. Es el 3er argumento
 * OBLIGATORIO de `saveProgram`: obligatorio para que el typecheck fuerce a cada puerta
 * presente y futura a declarar con qué autorización escribe. */
export type ProgramCaller = {
  emailVerified: boolean;
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
 * EL INVARIANTE CREAR ≠ EDITAR (spec 0077 §5, ADR 0076 §1), puro y fuera del writer para
 * que se pueda medir sin base.
 *
 * ```
 * si (el programa existe)  → es EDICION → exige email verificado (o staff)
 * si (no existe)           → es CREACION → permitida SIEMPRE
 * ```
 *
 * **Crear siempre se permite**: es la decisión del owner del ADR 0070 §11 («para el alta no
 * pedimos verificación»).
 *
 * Es el UNICO control de email al editar: `PUT /api/loyalty-program` usa
 * `requireApiPermissionSinGateDeEmail` (spec 0156, medido).
 */
export function programEditDenied(
  input: ProgramCaller & { isEdit: boolean },
): { status: 403; code: "email_not_verified"; message: string } | null {
  if (!input.isEdit) return null;
  // Spec 0086 §10: el paso 4 de la escalera ya decidio EXCEPTUAR al staff, y re-imponer el
  // gate aca seria deshacer esa decision una capa mas abajo. `=== true` y no `!`: un
  // `undefined` deja el gate PUESTO (fail-closed en el dato).
  if (input.isStaff === true) return null;
  if (input.emailVerified === true) return null;
  return {
    status: 403,
    code: "email_not_verified",
    message: "Verificá tu email para editar el programa.",
  };
}
