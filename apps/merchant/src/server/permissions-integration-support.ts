import { eq } from "drizzle-orm";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
/** Si la rama de Neon está cableada. Los dos archivos de integración de la spec 0086 la leen
 * de acá para no repetir el `skipIf`. */
export const permisosIntegrationEnabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() lee DATABASE_URL de forma perezosa; apuntarlo a la rama aislada ANTES de importarlo.
if (permisosIntegrationEnabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, memberships, users } from "./schema";
import { openMerchantSession } from "./merchant-session";

/**
 * EL MONTAJE COMPARTIDO de los dos archivos de integración de la spec 0086 (el writer de
 * permisos y las superficies delegadas), aparte por el hook `file-size`: los dos siembran un
 * negocio con su owner y abren sesiones reales, y un seed duplicado diverge sin que nadie lo
 * vea. **Acá no hay ni un `expect`**: esto es el montaje, los oráculos viven en los tests.
 */
export async function seedOwnerDeNegocio(
  userId: string,
  businessId: string,
  slug: string,
): Promise<void> {
  const db = getDb();
  await db.insert(users).values({
    id: userId,
    name: "Owner Perm",
    email: `${userId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(businesses).values({
    id: businessId,
    name: "Perm QA",
    slug,
    countryCode: "EC",
    timezone: "America/Guayaquil",
  });
  await db
    .insert(memberships)
    .values({ businessId, userId, role: "owner", status: "active" });
}

/** Cookie de una sesión REAL (`internalAdapter.createSession`), no un doble. */
export const cookieDe = async (userId: string): Promise<string> =>
  (await openMerchantSession(userId)).split(";")[0];

export async function limpiarNegocios(
  businessIds: string[],
  userIds: string[],
): Promise<void> {
  const db = getDb();
  for (const businessId of businessIds) {
    await db.delete(memberships).where(eq(memberships.businessId, businessId));
    await db.delete(businesses).where(eq(businesses.id, businessId));
  }
  for (const userId of userIds) {
    await db.delete(users).where(eq(users.id, userId));
  }
}

/** Una request JSON con la cookie de sesión puesta. */
export const conCookie = (
  path: string,
  method: string,
  cookie: string,
  body?: unknown,
): Request =>
  new Request(`http://localhost:3001${path}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
