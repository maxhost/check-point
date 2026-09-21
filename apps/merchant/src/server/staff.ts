import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { businesses, memberships, sessions, users } from "./schema";
import { normalizePermissions } from "./permissions-catalog";
import { StaffError } from "./staff-error";
import { assertTargetNotAdministrator } from "./staff-admin-target";

/** Los dos viven en archivos propios desde que este llego al limite del hook `file-size`
 * (327/300): **dividir, no extender**. Se re-exportan para que los ~20 modulos que hacen
 * `from "./staff"` no cambien ni una linea, y porque `StaffError` en un archivo sin imports es
 * lo que rompe el ciclo con el guard. */
export { StaffError } from "./staff-error";
export { assertTargetNotAdministrator } from "./staff-admin-target";

export type StaffDTO = {
  userId: string;
  name: string;
  /** `handle@slug` — el identificador con el que el integrante entra al mostrador. */
  identifier: string;
  role: string;
  status: string;
  /** Spec 0086 §5 — los alcances del integrante, **normalizados** (deduplicados y en el
   * orden del catalogo). Nunca es `[]` para un `role='staff'`: el `CHECK 3` de la migracion
   * 0041 lo vuelve imposible en la base y el writer lo rechaza antes con
   * `400 permissions_required`. */
  permissions: string[];
  createdAt: string;
};

export type StaffStatus = "active" | "disabled";

/** Spec 0067 §4 + spec 0086 §5: el owner escribe el nombre **y elige los permisos**. Ni
 * email, ni contraseña, ni slug. */
export type CreateStaffInput = {
  name: string;
  permissions: string[];
};

/** El PIN en claro viaja **una sola vez**, en la respuesta del alta o de la regeneracion. */
export type CreatedStaff = {
  staff: StaffDTO;
  pin: string;
};

/**
 * The owner's (active) business, or null. `api/staff/*` are owner-only + business-scoped.
 *
 * **Selecciona `status` y `suspension_reason` desde la spec 0072**: es el resolvedor de
 * `requireApiOwner`, o sea de las 10 superficies de API del owner, y leer el eje `status`
 * es **una columna mas en un `innerJoin(businesses)` que ya existia** — no una consulta
 * nueva. Quien dobla esta funcion en un test tiene que devolver `status` tambien: el guard
 * es fail-closed y una fila sin `status` no opera.
 *
 * **`countryCode` desde la spec 0081 §4**, por el mismo motivo y con el mismo costo: la
 * ruta de plantillas del TOS filtra por el scope del pais y tiene que hacerlo con la MISMA
 * fila que evaluo el guard. Resolver el negocio otra vez (con `ownerBusiness`, que ordena
 * `desc(createdAt)` contra el `asc` de aca) seria gatear sobre una fila y filtrar sobre
 * otra — la divergencia que la 0072 §D3 declara abierta.
 */
export async function ownerContext(userId: string): Promise<{
  id: string;
  slug: string;
  countryCode: string;
  currencyCode: string;
  status: string;
  suspensionReason: string | null;
} | null> {
  const [row] = await getDb()
    .select({
      id: businesses.id,
      slug: businesses.slug,
      countryCode: businesses.countryCode,
      currencyCode: businesses.currencyCode,
      status: businesses.status,
      suspensionReason: businesses.suspensionReason,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.role, "owner"),
        eq(memberships.status, "active"),
      ),
    )
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Spec 0086 §2 — EL GEMELO DE {@link ownerContext} PARA EL GUARD DE PERMISOS: resuelve la
 * membresia ACTIVA del caller **sea owner o staff**, y trae `role` y `permissions`.
 *
 * Mismas columnas, mismo `innerJoin(businesses)`, mismo `orderBy(asc(createdAt))` y mismo
 * `limit(1)` que `ownerContext`: lo UNICO que cambia es que no filtra `role='owner'`. Ese
 * orden identico es lo que garantiza que el guard nuevo y el viejo resuelvan LA MISMA fila
 * para un mismo owner — gatear con un resolvedor y escribir con otro es la divergencia
 * `asc`/`desc` que la spec 0072 §D3 dejo declarada.
 *
 * **Sigue filtrando `memberships.status='active'`** (ADR 0044): una membresia dada de baja
 * conserva identidad y auditoria y pierde acceso, tenga los permisos que tenga.
 *
 * `permissions` es **una columna mas en una consulta que ya se hacia**, no una consulta
 * nueva (ADR 0079 §4).
 */
export async function membershipContext(userId: string): Promise<{
  id: string;
  slug: string;
  countryCode: string;
  currencyCode: string;
  status: string;
  suspensionReason: string | null;
  role: string;
  permissions: string[];
} | null> {
  const [row] = await getDb()
    .select({
      id: businesses.id,
      slug: businesses.slug,
      countryCode: businesses.countryCode,
      currencyCode: businesses.currencyCode,
      status: businesses.status,
      suspensionReason: businesses.suspensionReason,
      role: memberships.role,
      permissions: memberships.permissions,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(eq(memberships.userId, userId), eq(memberships.status, "active")),
    )
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return row ?? null;
}

/** Forma publica de una fila de staff. Lo comparten el listado, la baja y el alta. */
export function toStaffDTO(row: {
  userId: string;
  name: string;
  handle: string | null;
  slug: string;
  role: string;
  status: string;
  permissions: string[] | null;
  createdAt: Date;
}): StaffDTO {
  return {
    userId: row.userId,
    name: row.name,
    identifier: row.handle ? `${row.handle}@${row.slug}` : "",
    role: row.role,
    status: row.status,
    // `normalizePermissions` y no `row.permissions` crudo: el `CHECK` de contencion de la
    // base NO impide duplicados, asi que una fila escrita por fuera del writer podria traer
    // `{catalog,catalog}`. La forma que sale por la API es siempre la normalizada.
    permissions: normalizePermissions(row.permissions ?? []),
    createdAt: row.createdAt.toISOString(),
  };
}

/** All staff of a business (role='staff'), oldest first. DTOs carry no secrets. */
export async function listStaff(businessId: string): Promise<StaffDTO[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      name: users.name,
      handle: memberships.handle,
      slug: businesses.slug,
      role: memberships.role,
      status: memberships.status,
      permissions: memberships.permissions,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.role, "staff"),
      ),
    )
    .orderBy(asc(memberships.createdAt));
  return rows.map(toStaffDTO);
}

/**
 * Activates or deactivates a staff member of the owner's business. Deactivating revokes
 * every merchant_auth session of that user (cutting live access) without deleting the user
 * or their audit trail. 404 when the target is not staff of this business; 409 when it is
 * the owner (an owner is never deactivated). Business-scoped → cross-business is a 404.
 *
 * **`callerRole` entra desde el GUARD** (nunca del cuerpo) porque desde el 2026-09-21 esta
 * superficie lleva R5: un no-owner no da de baja a un administrador.
 */
export async function setStaffStatus(
  business: { id: string; slug: string },
  callerRole: string,
  targetUserId: string,
  status: unknown,
): Promise<StaffDTO> {
  if (status !== "active" && status !== "disabled") {
    throw new StaffError(400, "El estado no es válido.", "invalid_status");
  }
  if (typeof targetUserId !== "string" || !targetUserId) {
    throw new StaffError(400, "El integrante no es válido.", "invalid_target");
  }

  const [target] = await getDb()
    // `permissions` viaja en el MISMO `select` que ya traia `role`: es una columna mas en una
    // consulta que ya se hacia, no una consulta nueva.
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
    throw new StaffError(404, "Ese integrante no existe.", "staff_not_found");
  if (target.role === "owner") {
    throw new StaffError(
      409,
      "No puedes desactivar al owner del negocio.",
      "target_is_owner",
    );
  }
  // R5 — despues del 404 y del 409, para no filtrar existencia con el 403.
  assertTargetNotAdministrator(callerRole, target.permissions);

  const [row] = await getDb()
    .update(memberships)
    .set({ status })
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

  if (status === "disabled") {
    await getDb().delete(sessions).where(eq(sessions.userId, targetUserId));
  }

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
