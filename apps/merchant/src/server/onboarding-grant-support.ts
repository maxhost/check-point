import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
  sessions,
  users,
} from "./schema";
import { openMerchantSession } from "./merchant-session";

/**
 * Soporte de los dos archivos de integración de la spec 0077
 * (`onboarding-grant.neon…` y `onboarding-grant-cortes.neon…`). Existe porque el montaje
 * es el mismo —un owner con `emailVerified: false`, que es como nace toda cuenta de
 * `auth/start`— y los dos archivos juntos pasaban el límite del hook `file-size`.
 *
 * No dobla nada: todo lo de acá escribe en la base real.
 */
export type GrantSeed = {
  ownerId: string;
  businessId: string;
  slug: string;
};

export async function seedUnverifiedOwner(tag: string): Promise<GrantSeed> {
  const ownerId = `grant-${tag}-${randomUUID()}`;
  const businessId = randomUUID();
  const slug = `grant-${businessId.slice(0, 12)}`;
  const db = getDb();
  await db.insert(users).values({
    id: ownerId,
    name: "Owner Sin Verificar",
    email: `${ownerId}@example.test`,
    // `false` ES el montaje de la spec, no un descuido del seed.
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(businesses).values({
    id: businessId,
    name: "El Permiso de Alta",
    slug,
    categoryGcid: "gcid:pharmacy",
    countryCode: "EC",
    timezone: "America/Guayaquil",
  });
  await db
    .insert(memberships)
    .values({ businessId, userId: ownerId, role: "owner" });
  return { ownerId, businessId, slug };
}

export async function dropGrantSeed(seed: GrantSeed): Promise<void> {
  const db = getDb();
  await wipePrograms(seed.businessId);
  await db
    .delete(memberships)
    .where(eq(memberships.businessId, seed.businessId));
  await db.delete(businesses).where(eq(businesses.id, seed.businessId));
  await db.delete(users).where(eq(users.id, seed.ownerId));
}

export async function wipePrograms(businessId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(loyaltyProgramEvents)
    .where(eq(loyaltyProgramEvents.businessId, businessId));
  await db
    .delete(loyaltyRewards)
    .where(eq(loyaltyRewards.businessId, businessId));
  await db
    .delete(loyaltyPrograms)
    .where(eq(loyaltyPrograms.businessId, businessId));
}

export const wipeSessions = (userId: string) =>
  getDb().delete(sessions).where(eq(sessions.userId, userId));

/** Las filas de sesión del usuario, con la columna del permiso. Es el oráculo: el permiso
 * sólo existe ahí, nunca en una respuesta. */
export const grantRowsOf = (userId: string) =>
  getDb()
    .select({ id: sessions.id, until: sessions.onboardingGrantUntil })
    .from(sessions)
    .where(eq(sessions.userId, userId));

/** Abre una sesión real; `minutesFromNow === null` es una sesión SIN permiso. */
export async function openSessionCookie(
  userId: string,
  minutesFromNow: number | null,
): Promise<string> {
  const cookie = await openMerchantSession(
    userId,
    minutesFromNow === null
      ? {}
      : {
          onboardingGrantUntil: new Date(Date.now() + minutesFromNow * 60_000),
        },
  );
  return cookie.split(";")[0];
}

/** `POST /api/onboarding/program` con el cuerpo corto del wizard. */
export const wizardBody = {
  target: 7,
  reward: { type: "custom", label: "Café" },
};

export const wizardRequest = (cookie: string) =>
  new Request("http://localhost:3001/api/onboarding/program", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(wizardBody),
  });
