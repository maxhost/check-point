import { and, asc, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { getMerchantAuth } from "./auth";
import { getDb } from "./db";
import { businesses, memberships, sessions, users } from "./schema";

/** Typed domain error: HTTP status + user message. Mirrors CounterError/BrandError. */
export class StaffError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Public staff row: never serializes a password hash, session token or account id. */
export type StaffDTO = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

export type StaffStatus = "active" | "disabled";

export type CreateStaffInput = {
  name: string;
  email: string;
  password: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The owner's (active) business, or null. `api/staff/*` are owner-only + business-scoped. */
export async function ownerContext(
  userId: string,
): Promise<{ id: string; currencyCode: string } | null> {
  const [row] = await getDb()
    .select({ id: businesses.id, currencyCode: businesses.currencyCode })
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

/** Validates + normalizes the alta body. Throws 400 on a bad field or short password. */
function parseCreateStaffInput(value: unknown): CreateStaffInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StaffError(400, "El cuerpo no es válido.");
  }
  const body = value as Record<string, unknown>;
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = rawName || null;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!name) throw new StaffError(400, "El nombre es obligatorio.");
  if (!EMAIL_RE.test(email))
    throw new StaffError(400, "El email no es válido.");
  if (password.length < 8) {
    throw new StaffError(
      400,
      "La contraseña debe tener al menos 8 caracteres.",
    );
  }
  return { name, email, password };
}

function toStaffDTO(row: {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
}): StaffDTO {
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Creates a staff user for the owner's business (ADR 0044): provisions the user via
 * better-auth `signUpEmail` (correct password hash; NEVER a raw insert) and DISCARDS the
 * returned session — the owner's cookie is untouched (no nextCookies plugin) — then inserts
 * the `role='staff', status='active'` membership. A duplicate email → 409.
 */
export async function createStaff(
  business: { id: string },
  value: unknown,
): Promise<StaffDTO> {
  const input = parseCreateStaffInput(value);

  const [existing] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);
  if (existing) throw new StaffError(409, "Ese email ya está en uso.");

  let userId: string;
  try {
    const result = await getMerchantAuth().api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    });
    userId = result.user.id;
  } catch (error) {
    if (error instanceof APIError) {
      // The only expected functional failure after validation is a duplicate email.
      throw new StaffError(409, "Ese email ya está en uso.");
    }
    throw new StaffError(
      503,
      "No pudimos crear al integrante. Intenta de nuevo.",
    );
  }

  try {
    const [row] = await getDb()
      .insert(memberships)
      .values({
        businessId: business.id,
        userId,
        role: "staff",
        status: "active",
      })
      .returning({
        role: memberships.role,
        status: memberships.status,
        createdAt: memberships.createdAt,
      });
    return toStaffDTO({
      userId,
      name: input.name,
      email: input.email,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt,
    });
  } catch {
    // Roll back the just-created auth user so the email is not burned (a user without an
    // active membership can't enter, but leaving it would make re-adding that email 409
    // forever). FK cascades drop its account/session rows.
    await getDb()
      .delete(users)
      .where(eq(users.id, userId))
      .catch(() => {});
    throw new StaffError(
      503,
      "No pudimos crear al integrante. Intenta de nuevo.",
    );
  }
}

/** All staff of a business (role='staff'), oldest first. DTOs carry no secrets. */
export async function listStaff(businessId: string): Promise<StaffDTO[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      status: memberships.status,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
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
  business: { id: string },
  targetUserId: string,
  status: unknown,
): Promise<StaffDTO> {
  if (status !== "active" && status !== "disabled") {
    throw new StaffError(400, "El estado no es válido.");
  }
  if (typeof targetUserId !== "string" || !targetUserId) {
    throw new StaffError(400, "El integrante no es válido.");
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
  if (!target) throw new StaffError(404, "Ese integrante no existe.");
  if (target.role === "owner") {
    throw new StaffError(409, "No puedes desactivar al owner del negocio.");
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
      createdAt: memberships.createdAt,
    });

  if (status === "disabled") {
    await getDb().delete(sessions).where(eq(sessions.userId, targetUserId));
  }

  const [profile] = await getDb()
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  return toStaffDTO({
    userId: targetUserId,
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
  });
}
