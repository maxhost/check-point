/**
 * Typed domain error: HTTP status + user message. Mirrors CounterError/BrandError.
 *
 * El `code` es **estable** y es lo que consume la UI de afuera: los mensajes son copia y
 * se pueden reescribir, los codigos no. Estan listados en
 * `docs/specs/0067-contratos-de-api.md`, que es el oraculo del revisor.
 */
export class StaffError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = "staff_error",
  ) {
    super(message);
  }
}

/**
 * Public staff row: never serializes a PIN, a hash, a session token or an account id.
 *
 * **Y tampoco el email** (spec 0068 §2): el de un integrante es el **sintetico**
 * `staff-<uuid>@staff.invalid` que el alta genera porque `merchant_auth.user.email` es
 * `NOT NULL` con unico. Se PERSISTE, pero no se serializa nunca: devolverlo al navegador
 * seria entregar el mismo contacto falso que motivo borrar la consola de staff. Misma
 * regla que `toClientProgram` y `brandResponse` con las claves de R2. Lo que el owner
 * reparte es `identifier` (`handle@slug`).
 */
