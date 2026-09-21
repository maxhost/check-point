import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { memberships, users } from "./schema";
import { type StaffDTO, StaffError, toStaffDTO } from "./staff";
import { freeHandle, isUniqueViolation } from "./staff-create";

/**
 * Spec 0087 — **EL RENOMBRE DEL INTEGRANTE**, el writer de `PATCH /api/staff/{userId}`.
 *
 * Archivo propio y no dentro de `staff.ts` (282 lineas) ni de `staff-create.ts` (228): el
 * hook `file-size` corta en 300 y la regla del repo es dividir, no extender.
 *
 * Las tres cosas que decide este modulo, todas del ADR 0080:
 *
 * 1. **El identificador SIGUE AL NOMBRE.** Renombrar RE-DERIVA el handle, o sea que cambia
 *    con que string entra esa persona (`api/merchant/auth/staff/route.ts:194` resuelve la
 *    membresia con `eq(memberships.handle, handle)`). Por eso el DTO devuelve SIEMPRE el
 *    `identifier` nuevo, aunque no haya cambiado: sin eso la decision es una trampa
 *    silenciosa.
 * 2. **El cuerpo con `permissions` se RECHAZA, no se ignora** (ver {@link parseRenameInput}).
 * 3. **R3 no vale acá**: uno mismo SI edita su propio nombre. La regla «nadie se edita a si
 *    mismo» es de los PERMISOS y vive en `staff-permissions.ts`, que esta spec **no toca**.
 *
 * Lo que NO se reimplementa: la derivacion pasa por `freeHandle` → `nextSuggestion`, asi que
 * hereda gratis las palabras reservadas y el sufijo de colision. Escribir el handle a mano
 * habria obligado a reconstruir las dos cosas y habria dejado pedirse `admin`.
 */

/** El `code` de cada rechazo de esta superficie. Es el contrato
 * (`docs/specs/0087-contratos-de-api.md` §2); el mensaje es copia.
 *
 * **Los tres del nombre son LOS MISMOS del alta** (`staff-create.ts:33-41`), no unos nuevos:
 * la UI ya los mapea y un `invalid_name` propio la obligaria a aprender un cuarto. */
export const STAFF_RENAME_CODES = {
  invalidBody: "invalid_body",
  nameRequired: "name_required",
  nameTooLong: "name_too_long",
  permissionsNotHere: "permissions_not_here",
  targetIsOwner: "target_is_owner",
  handleTaken: "handle_taken",
  staffNotFound: "staff_not_found",
} as const;

/** El largo maximo del nombre, el mismo del alta. */
const NAME_MAX_LENGTH = 80;

/**
 * Valida el cuerpo del renombre. **`name` es el unico campo aceptado.**
 *
 * **`permissions` se rechaza por PRESENCIA DE LA CLAVE, no por su valor** (ADR 0080 §2):
 * tambien con `null`, con `[]` y con los permisos que el integrante ya tiene. «Es el mismo
 * valor, es un no-op» es exactamente el bypass que esta regla existe para cerrar — el dia que
 * el chequeo mire el valor, un cuerpo con los permisos actuales entra por esta ruta y las dos
 * politicas de autorizacion (la del nombre, que **si** permite editarse a uno mismo, y la de
 * los permisos, que no) quedan en el mismo camino de codigo.
 *
 * **Y se RECHAZA en vez de ignorarse**: un descarte silencioso haria que la UI crea haber
 * guardado permisos que nadie guardo.
 *
 * Va ANTES de mirar `name` a proposito: mandar `permissions` acá es un error de RUTA, no de
 * contenido, y contestar `name_required` a quien ademas se equivoco de ruta manda a la UI a
 * arreglar el campo equivocado.
 */
export function parseRenameInput(value: unknown): { name: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StaffError(
      400,
      "El cuerpo no es válido.",
      STAFF_RENAME_CODES.invalidBody,
    );
  }
  const body = value as Record<string, unknown>;
  if ("permissions" in body) {
    throw new StaffError(
      400,
      "Los permisos se editan en PATCH /api/staff/{userId}/permissions.",
      STAFF_RENAME_CODES.permissionsNotHere,
    );
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name)
    throw new StaffError(
      400,
      "El nombre es obligatorio.",
      STAFF_RENAME_CODES.nameRequired,
    );
  if (name.length > NAME_MAX_LENGTH)
    throw new StaffError(
      400,
      "El nombre es muy largo.",
      STAFF_RENAME_CODES.nameTooLong,
    );
  return { name };
}

/**
 * Renombra a un integrante del negocio y devuelve el `StaffDTO` con el `identifier` nuevo.
 *
 * **El aislamiento lo da el `UPDATE`, que lleva `business_id` en el `WHERE` resuelto desde la
 * SESION y nunca del cuerpo** (mismo patron que `…/pin/regenerate`). Un caller del negocio A
 * apuntando a un staff de B no matchea ninguna fila → 404, no 403: un 403 confirmaria que ese
 * id existe.
 *
 * **Y por eso el 404 / 409 se deciden DESPUES del `UPDATE` y no antes**: un chequeo previo
 * scopeado por negocio dejaria el `business_id` del `UPDATE` sin nadie que lo distinga —
 * seria la unica proteccion real y a la vez la unica sin oraculo. Acá el `UPDATE` es el que
 * aisla, y la lectura de desempate corre **solo cuando no matcheo nada**, asi que nunca lo
 * tapa.
 *
 * El `users.name` se escribe **despues** del `UPDATE` de la membresia y solo si matcheo:
 * `merchant_auth.user` no tiene `business_id`, asi que escribirlo primero renombraria al
 * integrante de otro negocio antes de rebotar con el 404.
 */
export async function renameStaff(
  business: { id: string; slug: string },
  targetUserId: string,
  value: unknown,
): Promise<StaffDTO> {
  const { name } = parseRenameInput(value);
  // Con `targetUserId`: el handle que ese integrante tiene HOY no cuenta como ocupado.
  const handle = await freeHandle(business.id, name, targetUserId);
  const row = await updateHandle(business.id, targetUserId, handle);
  if (!row) throw await rejectionFor(business.id, targetUserId);

  await getDb().update(users).set({ name }).where(eq(users.id, targetUserId));

  return toStaffDTO({
    userId: targetUserId,
    name,
    handle: row.handle,
    slug: business.slug,
    role: row.role,
    status: row.status,
    permissions: row.permissions,
    createdAt: row.createdAt,
  });
}

/**
 * El `UPDATE` de la membresia. `role='staff'` en el `WHERE` deja la membresia del OWNER sin
 * matchear (R4 se contesta en {@link rejectionFor}), y `business_id` es el aislamiento.
 *
 * El choque del unico `core_business_membership_handle_unique` sale como **409 handle_taken**,
 * el mismo `code` del alta: es la carrera que el TOCTOU de `freeHandle` deja abierta y quien
 * decide es el indice, no la lectura previa. Cualquier otro fallo se re-lanza y la ruta lo
 * presenta como el `503 staff_unavailable` del contrato.
 */
async function updateHandle(
  businessId: string,
  targetUserId: string,
  handle: string,
) {
  try {
    const [row] = await getDb()
      .update(memberships)
      .set({ handle })
      .where(
        and(
          eq(memberships.businessId, businessId),
          eq(memberships.userId, targetUserId),
          eq(memberships.role, "staff"),
        ),
      )
      .returning({
        role: memberships.role,
        status: memberships.status,
        permissions: memberships.permissions,
        handle: memberships.handle,
        createdAt: memberships.createdAt,
      });
    return row ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new StaffError(
        409,
        "Ese identificador ya está en uso.",
        STAFF_RENAME_CODES.handleTaken,
      );
    }
    throw error;
  }
}

/**
 * Por que no matcheo el `UPDATE`, y corre **solo** en ese caso: la membresia del OWNER
 * (R4 → `409 target_is_owner`, el mismo `code` y status que `setStaffStatus`) o cualquier
 * otra cosa (`404 staff_not_found`).
 *
 * **Esta lectura tambien va scopeada por negocio**, y eso es lo que hace que el owner de OTRO
 * negocio reciba 404 y no 409: el 409 confirmaria que ese id existe y ademas quien es.
 *
 * **ORACULO de esa frase** (sin el era una afirmacion sin nadie que la muerda): el caso de
 * aislamiento de `staff-rename.neon.integration.test.ts` apunta al owner de B desde A. Es el
 * UNICO vector que distingue este `business_id`, porque un INTEGRANTE ajeno da 404 con el
 * scope puesto **y** sin el. Medido sacandoselo: ese caso pasa a «expected 409 to be 404».
 */
async function rejectionFor(
  businessId: string,
  targetUserId: string,
): Promise<StaffError> {
  const [target] = await getDb()
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.userId, targetUserId),
      ),
    )
    .limit(1);
  if (target?.role === "owner") {
    return new StaffError(
      409,
      "No puedes editar al owner del negocio.",
      STAFF_RENAME_CODES.targetIsOwner,
    );
  }
  return new StaffError(
    404,
    "Ese integrante no existe.",
    STAFF_RENAME_CODES.staffNotFound,
  );
}
