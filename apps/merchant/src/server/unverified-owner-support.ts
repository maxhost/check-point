import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
  users,
} from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "./merchant-session";

/**
 * Montaje compartido de las suites de integración que necesitan un owner con
 * `emailVerified: false`, que es como nace toda cuenta de `POST /api/onboarding/signup`
 * (spec 0155). Spec 0156: lo del permiso de alta se borro con el permiso.
 *
 * No dobla nada: todo lo de acá escribe en la base real.
 */
export type OwnerSeed = {
  ownerId: string;
  businessId: string;
  slug: string;
};

export async function seedUnverifiedOwner(tag: string): Promise<OwnerSeed> {
  const ownerId = `owner-${tag}-${randomUUID()}`;
  const businessId = randomUUID();
  const slug = `owner-${businessId.slice(0, 12)}`;
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
    name: "Owner Sin Verificar",
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

export async function dropOwnerSeed(seed: OwnerSeed): Promise<void> {
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

/** Abre una sesión real y devuelve el par `nombre=valor` de la cookie. */
export async function openSessionCookie(userId: string): Promise<string> {
  const cookie = await openMerchantSession(userId);
  return cookie.split(";")[0];
}
