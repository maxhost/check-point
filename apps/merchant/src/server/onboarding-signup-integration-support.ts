import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  authStartAttempts,
  businesses,
  memberships,
  users,
} from "@mi-pasaporte/db/schema";
import { POST as SIGNUP } from "../app/api/onboarding/signup/route";
import { testSelectionToken } from "./places/selection-test-support";

/**
 * Spec 0155 — el montaje de `onboarding-signup.neon.integration.test.ts`, separado por el
 * limite de tamaño. Todo escribe y lee la base real; nada se dobla.
 *
 * Importarlo NO apunta `DATABASE_URL` a la rama aislada: eso lo hace el archivo de test
 * antes de importar esto.
 */
export type SignupBody = {
  email: unknown;
  business?: Record<string, unknown>;
};

export function signupRequest(body: SignupBody | string, ip?: string): Request {
  return new Request("http://localhost:3001/api/onboarding/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ip ? { "x-forwarded-for": ip } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** El cuerpo de P4 con un negocio valido y un token real; `business` pisa campos. */
export function signupBody(
  email: unknown,
  business: Record<string, unknown> = {},
): SignupBody {
  return {
    email,
    business: {
      name: `Negocio ${randomUUID().slice(0, 8)}`,
      categoryGcid: "gcid:pharmacy",
      selectionToken: testSelectionToken(),
      ...business,
    },
  };
}

export const signup = (body: SignupBody | string, ip?: string) =>
  SIGNUP(signupRequest(body, ip));

export async function userByEmail(email: string) {
  const rows = await getDb().execute<{
    id: string;
    name: string;
    email_verified: boolean;
    accounts: number;
  }>(
    sql`SELECT u.id, u.name, u.email_verified,
             (SELECT count(*)::int FROM merchant_auth.account a
               WHERE a.user_id = u.id) AS accounts
          FROM merchant_auth."user" u WHERE lower(u.email) = ${email}`,
  );
  return rows.rows;
}

export async function countSql(query: ReturnType<typeof sql>) {
  const rows = await getDb().execute<{ n: number }>(query);
  return rows.rows[0].n;
}

export const sessionCount = (userId: string) =>
  countSql(
    sql`SELECT count(*)::int AS n FROM merchant_auth.session WHERE user_id = ${userId}`,
  );

export const linkTokenCount = (email: string) =>
  countSql(
    sql`SELECT count(*)::int AS n FROM merchant_auth.verification
         WHERE value LIKE ${`%${email}%`}`,
  );

export const attemptCount = (email: string) =>
  countSql(
    sql`SELECT count(*)::int AS n FROM merchant_auth.auth_start_attempt
         WHERE email = ${email}`,
  );

/** Inserta un `user` por SQL crudo —sin pasar por ningun escritor que normalice— y devuelve
 * `null` si entro o el `code`/`constraint` del rechazo (spec 0156 B). */
export async function rawUserInsertViolation(
  id: string,
  email: string,
): Promise<{ code?: string; constraint?: string } | null> {
  try {
    await getDb().execute(
      sql`INSERT INTO merchant_auth."user" (id, name, email, email_verified, created_at, updated_at)
           VALUES (${id}, 'Mayus', ${email}, false, now(), now())`,
    );
    return null;
  } catch (error) {
    const cause = (error as { cause?: { code?: string; constraint?: string } })
      .cause;
    return { code: cause?.code, constraint: cause?.constraint };
  }
}

export const businessesNamed = (name: string) =>
  countSql(
    sql`SELECT count(*)::int AS n FROM core.business WHERE name = ${name}`,
  );

/** Borra, por email, la cuenta, su negocio (en cascada: local, verificacion, suscripcion,
 * membresia), los intentos y los tokens de link. */
export async function dropSignups(emails: string[]): Promise<void> {
  const db = getDb();
  for (const email of emails) {
    for (const user of await userByEmail(email)) {
      const owned = await db
        .select({ businessId: memberships.businessId })
        .from(memberships)
        .where(eq(memberships.userId, user.id));
      if (owned.length)
        await db.delete(businesses).where(
          inArray(
            businesses.id,
            owned.map((row) => row.businessId),
          ),
        );
      await db.delete(users).where(eq(users.id, user.id));
    }
    await db
      .delete(authStartAttempts)
      .where(eq(authStartAttempts.email, email));
    await db.execute(
      sql`DELETE FROM merchant_auth.verification WHERE value LIKE ${`%${email}%`}`,
    );
  }
}
