import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { businesses, memberships, sessions, users } from "./schema";

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
export type StaffDTO = {
  userId: string;
  name: string;
  /** `handle@slug` — el identificador con el que el integrante entra al mostrador. */
  identifier: string;
  role: string;
  status: string;
  createdAt: string;
};

export type StaffStatus = "active" | "disabled";

/** Spec 0067 §4: el owner escribe **solo el nombre**. Ni email, ni contraseña, ni slug. */
export type CreateStaffInput = {
  name: string;
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
 */
export async function ownerContext(userId: string): Promise<{
  id: string;
  slug: string;
  currencyCode: string;
  status: string;
  suspensionReason: string | null;
} | null> {
  const [row] = await getDb()
    .select({
      id: businesses.id,
      slug: businesses.slug,
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

/** Forma publica de una fila de staff. Lo comparten el listado, la baja y el alta. */
export function toStaffDTO(row: {
  userId: string;
  name: string;
  handle: string | null;
  slug: string;
  role: string;
  status: string;
  createdAt: Date;
}): StaffDTO {
  return {
    userId: row.userId,
    name: row.name,
    identifier: row.handle ? `${row.handle}@${row.slug}` : "",
    role: row.role,
    status: row.status,
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
 */
export async function setStaffStatus(
  business: { id: string; slug: string },
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
    .select({ role: memberships.role })
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
    createdAt: row.createdAt,
  });
}
