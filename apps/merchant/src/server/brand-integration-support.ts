import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships, users } from "@mi-pasaporte/db/schema";
export const brandInput = (revision: number) => ({
  name: "Marca Integración",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
  revision,
  logoAction: "keep" as const,
});
export async function seedBrandWorld() {
  const userId = `brand-int-${randomUUID()}`,
    businessId = randomUUID();
  await getDb()
    .insert(users)
    .values({
      id: userId,
      name: "Owner Marca",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await getDb()
    .insert(businesses)
    .values({
      id: businessId,
      name: "Marca QA",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
  await getDb()
    .insert(memberships)
    .values({ businessId, userId, role: "owner" });
  return { userId, businessId };
}
export async function dropBrandWorld(
  world: Awaited<ReturnType<typeof seedBrandWorld>> | undefined,
) {
  if (!world) return;
  await getDb()
    .delete(memberships)
    .where(eq(memberships.businessId, world.businessId));
  await getDb().delete(businesses).where(eq(businesses.id, world.businessId));
  await getDb().delete(users).where(eq(users.id, world.userId));
}
