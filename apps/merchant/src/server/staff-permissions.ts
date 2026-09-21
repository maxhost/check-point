import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { memberships, users } from "./schema";
import {
  isPermission,
  normalizePermissions,
  PERMISSIONS,
} from "./permissions-catalog";
import { type StaffDTO, StaffError, toStaffDTO } from "./staff";

/**
 * Spec 0086 §4 y §5 — EL VALIDADOR Y EL WRITER DE LOS PERMISOS, con las CUATRO reglas
 * anti-escalada del ADR 0079 §3.
 *
 * Archivo propio y no dentro de `staff.ts` (235 lineas) ni de `staff-create.ts` (180): el
 * hook `file-size` corta en 300 y la regla del repo es **dividir, no extender**.
 *
 * | # | Regla | Respuesta |
 * |---|---|---|
 * | R1a | **Solo el owner OTORGA `staff`.** Un caller `role !== 'owner'` que mande `staff` en la lista | `403 permission_not_grantable` |
 * | R1b | **Solo el owner QUITA `staff`.** Un caller `role !== 'owner'` cuyo TARGET ya lo tiene | `403 permission_not_grantable` |
 * | R2 | **Un no-owner SI otorga cualquier otro permiso**, tenga o no ese permiso el mismo | — |
 * | R3 | **Nadie edita sus propios permisos**, tampoco el owner | `403 self_permission_edit` |
 * | R4 | **Ninguna superficie de staff toca la membresia del owner** | `409 target_is_owner` |
 *
 * **R1 es la regla que sostiene todo el §3 del ADR**: sin ella un administrador fabrica otro
 * administrador y el perfil deja de tener techo.
 *
 * **R2 es una decision TEXTUAL del owner** (*«si creo un admin para staff, y el necesita
 * crear un usuario para marketing, no podria… eso si es ridiculo»*), y su costo esta
 * aceptado por escrito: como el alta devuelve el PIN en claro, **crear a un tercero con el
 * permiso X equivale a tener X**. La escalada residual queda acotada a los SEIS permisos
 * no-`staff` y la cierra a futuro el PIN fuera de banda (`PARQUEADO` fila 60). Esta spec la
 * implementa ACEPTADA, no la resuelve.
 *
 * **R4 ya existia para el ESTADO** (`setStaffStatus`, `staff.ts`) y esta ruta usa **el mismo
 * `code` y el mismo status**, no uno nuevo.
 */

/** El `code` de cada rechazo propio de esta superficie. Es el contrato
 * (`docs/specs/0086-contratos-de-api.md` §5); el mensaje es copia. */
export const STAFF_PERMISSION_CODES = {
  permissionsRequired: "permissions_required",
  unknownPermission: "unknown_permission",
  permissionNotGrantable: "permission_not_grantable",
  selfPermissionEdit: "self_permission_edit",
  targetIsOwner: "target_is_owner",
  staffNotFound: "staff_not_found",
} as const;

/**
 * Parsea `permissions` de un cuerpo. **Obligatorio y con al menos un elemento** (decision del
 * owner: dar de alta a alguien que no puede hacer nada no tiene sentido, y para eso existe
 * desactivarlo).
 *
 * Un valor desconocido es `400 unknown_permission` **antes de llegar a la base**: el `CHECK`
 * de contencion de la migracion 0041 es la RED, no el validador. Que los dos lean la misma
 * lista (`PERMISSIONS`) es lo que impide que se separen.
 *
 * Devuelve la lista **normalizada** —deduplicada y en el orden del catalogo—, que es lo que
 * la API devuelve y lo que se escribe en la fila. El `CHECK` no impide duplicados
 * (`{catalog,catalog}` lo satisface), asi que la normalizacion es responsabilidad de acá.
 */
export function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new StaffError(
      400,
      "Elegí al menos un permiso.",
      STAFF_PERMISSION_CODES.permissionsRequired,
    );
  }
  for (const item of value) {
    if (!isPermission(item)) {
      throw new StaffError(
        400,
        `El permiso no existe. Los válidos son: ${PERMISSIONS.join(", ")}.`,
        STAFF_PERMISSION_CODES.unknownPermission,
      );
    }
  }
  const permissions = normalizePermissions(value);
  // DESPUES de normalizar, no antes: `[]` y `['catalog','catalog']` son casos distintos y
  // solo el primero es «lista vacia». Quitarle todo a alguien ya tiene nombre y es
  // DESACTIVARLO (`POST /api/staff/{userId}/status`).
  if (permissions.length === 0) {
    throw new StaffError(
      400,
      "Elegí al menos un permiso.",
      STAFF_PERMISSION_CODES.permissionsRequired,
    );
  }
  return permissions;
}

/**
 * R1a — **solo el OWNER otorga `staff`**. Se evalua sobre el rol del CALLER, que sale de la
 * fila que resolvio el guard y nunca del cuerpo. **Mira la lista NUEVA**; la mitad que mira al
 * TARGET es {@link assertDemotable}.
 *
 * Vale tanto para el alta como para el `PATCH`: las dos superficies escriben el conjunto de
 * permisos de un tercero y las dos tienen que tener el mismo techo.
 */
export function assertGrantable(callerRole: string, permissions: string[]) {
  if (callerRole === "owner") return;
  if (permissions.includes("staff")) {
    throw new StaffError(
      403,
      "Solo el owner puede otorgar el permiso de administrar staff.",
      STAFF_PERMISSION_CODES.permissionNotGrantable,
    );
  }
}

/**
 * R1, LA OTRA MITAD — **solo el owner QUITA `staff`**. `assertGrantable` mira la lista NUEVA y
 * por eso no puede ver esto: un administrador que manda la lista **sin** `staff` a otro
 * administrador lo estaba degradando, y la unica barrera era la UI
 * (`staff-views.tsx`, `protectedAdministrator`) — justo lo que la pantalla le promete al
 * merchant con todas las letras («Solo el owner puede otorgarlo o quitarlo»,
 * `permission-picker.tsx:54`).
 *
 * **Corre DESPUES de resolver el target**, no antes, y el orden es contrato: un `userId` que no
 * existe tiene que seguir contestando `404 staff_not_found`. Si esta regla corriera primero,
 * contestaria `403` y con eso confirmaria que ese id existe.
 *
 * Reusa `permission_not_grantable`: es el mismo techo, el mismo rol y la misma copia ya
 * traducida en la UI. Un `code` nuevo seria una entrada mas en el catalogo compartido para
 * decir lo mismo.
 */
export function assertDemotable(
  callerRole: string,
  targetPermissions: readonly string[] | null | undefined,
) {
  if (callerRole === "owner") return;
  if ((targetPermissions ?? []).includes("staff")) {
    throw new StaffError(
      403,
      "Solo el owner puede quitar el permiso de administrar staff.",
      STAFF_PERMISSION_CODES.permissionNotGrantable,
    );
  }
}

/** R3 — **nadie edita sus propios permisos, tampoco el owner**. Sin esta regla un
 * administrador se auto-otorga `staff` y R1 deja de tener sentido. */
export function assertNotSelf(callerUserId: string, targetUserId: string) {
  if (callerUserId === targetUserId) {
    throw new StaffError(
      403,
      "No puedes editar tus propios permisos.",
      STAFF_PERMISSION_CODES.selfPermissionEdit,
    );
  }
}

/**
 * `PATCH /api/staff/:userId/permissions` — **REEMPLAZO TOTAL del conjunto, no un delta**: se
 * manda el conjunto de toggles que quedo prendido y lo que no viaja se quita. No existe
 * `add`/`remove`.
 *
 * El orden de las decisiones es contrato:
 *
 * 1. el cuerpo (`permissions_required` / `unknown_permission`);
 * 2. **R1** — `permission_not_grantable`;
 * 3. **R3** — `self_permission_edit`, **antes** de mirar la base: un owner que se apunta a si
 *    mismo recibe `self_permission_edit` y no `target_is_owner`, que seria el mismo 409 con
 *    el que se contesta a cualquiera que apunte al owner y perderia la regla especifica;
 * 4. el target (`staff_not_found` / **R4** `target_is_owner`);
 * 5. la escritura.
 *
 * **`staff_not_found` para el inexistente Y para el de otro negocio, a proposito** (contrato
 * §5): no se confirma que un id exista. El aislamiento lo da el `businessId`, que sale de la
 * SESION y nunca del cuerpo.
 */
export async function setStaffPermissions(
  business: { id: string; slug: string },
  caller: { userId: string; role: string },
  targetUserId: string,
  value: unknown,
): Promise<StaffDTO> {
  if (typeof targetUserId !== "string" || !targetUserId) {
    throw new StaffError(400, "El integrante no es válido.", "invalid_target");
  }
  const permissions = parsePermissions(value);
  assertGrantable(caller.role, permissions);
  assertNotSelf(caller.userId, targetUserId);

  const [target] = await getDb()
    // `permissions` viaja en el MISMO `select` que ya traia `role`: es una columna mas en una
    // consulta que ya se hacia, no una consulta nueva (mismo argumento con el que la 0086 sumo
    // la columna al guard).
    .select({ role: memberships.role, permissions: memberships.permissions })
    .from(memberships)
    .where(
      and(
        eq(memberships.businessId, business.id),
        eq(memberships.userId, targetUserId),
      ),
    )
    .limit(1);
  if (!target)
    throw new StaffError(
      404,
      "Ese integrante no existe.",
      STAFF_PERMISSION_CODES.staffNotFound,
    );
  if (target.role === "owner") {
    // R4 — mismo `code` y mismo status que `setStaffStatus`. El `CHECK 2` de la migracion
    // 0041 es la red: aunque este guard se cayera, la base rechaza un owner con permisos.
    throw new StaffError(
      409,
      "No puedes cambiar los permisos del owner del negocio.",
      STAFF_PERMISSION_CODES.targetIsOwner,
    );
  }
  // R1, la otra mitad. Va aca —paso 4bis— para que un id inexistente siga siendo 404.
  assertDemotable(caller.role, target.permissions);

  const [row] = await getDb()
    .update(memberships)
    .set({ permissions })
    .where(
      and(
        eq(memberships.businessId, business.id),
        eq(memberships.userId, targetUserId),
      ),
    )
    .returning({
      role: memberships.role,
      status: memberships.status,
      permissions: memberships.permissions,
      handle: memberships.handle,
      createdAt: memberships.createdAt,
    });

  const [profile] = await getDb()
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  return toStaffDTO({
    userId: targetUserId,
    name: profile?.name ?? "",
    handle: row.handle,
    slug: business.slug,
    role: row.role,
    status: row.status,
    permissions: row.permissions,
    createdAt: row.createdAt,
  });
}
