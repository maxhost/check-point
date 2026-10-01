/**
 * EL EJE `status` DEL NEGOCIO, PURO — spec 0072 §D4 / ADR 0073.
 *
 * **Este archivo no tiene un solo `import`, y eso es deliberado.** La decisión nació dentro de
 * `api-owner.ts`, que importa `next/server` y better-auth. Cuando el cierre de F1 la necesitó
 * desde `server/loyalty-program.ts` —para gatear el WRITER, que es el que tiene dos puertas—,
 * importarla de ahí habría arrastrado el runtime HTTP y el de auth a un módulo de dominio. Es la
 * misma forma del ciclo `entitlements → billing → locations` que costó 8 suites en el paso 1 de
 * esta spec, y la misma cura que `entitlements/live-subscription.ts`: la pieza de más abajo del
 * stack no importa nada. `api-owner.ts` re-exporta todo lo de acá, así que sus 12 consumidores
 * no cambian una línea.
 */

/**
 * Un fallo del gate como **DATO, no como `NextResponse`**: cada dominio tiene su propia forma de
 * error (`LocationError`, `CampaignError`, `BillingError`, `StaffError`, `LoyaltyError`) y su
 * propio `catch`, así que devolver una respuesta armada obligaría a todos a coincidir en el
 * envoltorio.
 */
export type ApiOwnerFailure = {
  status: number;
  code: string;
  message: string;
  /** El motivo de la suspensión. **Sólo viaja en `business_suspended` y sólo al owner** (spec
   * 0072 §D4): el staff no llega a verlo —no obtiene sesión— y el consumidor nunca lo recibe. */
  reason?: string;
};

/** Los `code` estables de los 401/403. Normalizados por decisión del owner del 2026-09-17
 * («sí al `status='active'`, sí a los `code`»). Son el contrato:
 * `docs/specs/0072-contratos-de-api.md`. */
export const API_OWNER_CODES = {
  unauthorized: "unauthorized",
  notOwner: "not_owner",
  emailNotVerified: "email_not_verified",
  businessSuspended: "business_suspended",
  businessClosed: "business_closed",
} as const;

export const DEFAULT_MESSAGES = {
  unauthorized: "No autorizado.",
  notOwner: "Solo el owner puede hacer esto.",
  emailNotVerified: "Verificá tu email para continuar.",
  businessSuspended: "Tu cuenta está suspendida.",
  businessClosed: "Esta cuenta está cerrada.",
};

/**
 * `null` = el negocio opera. La comparten `requireApiOwner`, el mostrador
 * (`api/counter/_auth.ts`), el backoffice y `saveProgram`.
 *
 * **Es `!== "active"` y no `=== "suspended"`, o sea fail-CLOSED**: la columna tiene un
 * `CHECK (status IN ('active','suspended','closed'))`, así que hoy no hay un cuarto valor; el
 * día que lo haya, un estado que nadie le enseñó a este guard tiene que frenar y no pasar de
 * largo. Misma polaridad que el `row.status !== "active"` de `requireBackofficeSession`.
 *
 * `reason` viaja SOLO en `business_suspended`: un negocio cerrado no tiene motivo que mostrar, y
 * el `suspension_reason` de una suspensión anterior sería información vieja.
 */
export function businessStatusFailure(
  status: string,
  suspensionReason: string | null,
  reasonVisible = true,
): ApiOwnerFailure | null {
  if (status === "active") return null;
  if (status === "closed") {
    return {
      status: 403,
      code: API_OWNER_CODES.businessClosed,
      message: DEFAULT_MESSAGES.businessClosed,
    };
  }
  return {
    status: 403,
    code: API_OWNER_CODES.businessSuspended,
    message: DEFAULT_MESSAGES.businessSuspended,
    ...(reasonVisible && suspensionReason !== null
      ? { reason: suspensionReason }
      : {}),
  };
}
