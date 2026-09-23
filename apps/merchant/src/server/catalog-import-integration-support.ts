import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
/** Si la rama de Neon esta cableada. Mismo interruptor que las otras 100 suites. */
export const importIntegrationEnabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// `getDb()` lee `DATABASE_URL` de forma perezosa; apuntarlo ANTES de importarlo.
if (importIntegrationEnabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  catalogImportCleanups,
  catalogImportFiles,
  catalogImports,
  memberships,
  productCategories,
  products,
  users,
} from "./schema";

/**
 * EL MONTAJE de las suites de integracion de la spec 0090.
 *
 * **Decision declarada del owner (2026-09-21): estas pruebas corren contra la MISMA base que
 * usa la app**, sin rama efimera. Consecuencia, y por eso esta escrito acá y no en un
 * comentario suelto: **cada test crea y borra SUS PROPIAS filas por id explicito, y ninguna
 * prueba trunca una tabla ni borra por rango ni por `like`.** El precedente correcto es
 * `limpiarNegocios` (`permissions-integration-support.ts:55-67`).
 *
 * **Acá no hay ni un `expect`**: esto es el montaje; los oraculos viven en los tests.
 */
export type SeedImport = {
  businessId: string;
  userId: string;
  slug: string;
};

export async function seedNegocio(nombre: string): Promise<SeedImport> {
  const db = getDb();
  const userId = `catimp-int-${randomUUID()}`;
  const businessId = randomUUID();
  await db.insert(users).values({
    id: userId,
    name: nombre,
    email: `${userId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(businesses).values({
    id: businessId,
    name: nombre,
    slug: `catimp-${businessId.slice(0, 20)}`,
    countryCode: "EC",
    timezone: "America/Guayaquil",
    currencyCode: "USD",
  });
  await db
    .insert(memberships)
    .values({ businessId, userId, role: "owner", status: "active" });
  return { businessId, userId, slug: `catimp-${businessId.slice(0, 20)}` };
}

/** Un integrante del negocio con los alcances que se le pidan. `emailVerified` queda en
 * `false`, que es **la forma de produccion** (`staff-create.ts:132`). */
export async function seedIntegrante(
  businessId: string,
  permissions: string[],
): Promise<string> {
  const userId = `catimp-int-${randomUUID()}`;
  await getDb()
    .insert(users)
    .values({
      id: userId,
      name: `Staff ${userId.slice(-6)}`,
      email: `${userId}@example.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await getDb()
    .insert(memberships)
    .values({
      businessId,
      userId,
      role: "staff",
      status: "active",
      handle: `seed-${userId.slice(-12)}`,
      pinHash: "seed-sin-pin",
      permissions,
    });
  return userId;
}

/** Inserta un import con el estado que el caso necesita, sin pasar por la API. */
export async function seedImport(opts: {
  businessId: string;
  userId: string;
  status: string;
  draft?: unknown;
  draftVersion?: number;
  createdAt?: Date;
  expiresAt?: Date;
  providerJobId?: string | null;
  provider?: string | null;
  leaseUntil?: Date | null;
  attemptCount?: number;
  acceptedSummary?: unknown;
}): Promise<string> {
  const id = randomUUID();
  await getDb()
    .insert(catalogImports)
    .values({
      id,
      businessId: opts.businessId,
      createdByUserId: opts.userId,
      status: opts.status,
      sourceKind: "images",
      fileCount: 1,
      draft: opts.draft ?? null,
      draftVersion: opts.draftVersion ?? (opts.draft ? 1 : 0),
      providerJobId: opts.providerJobId ?? null,
      provider: opts.provider ?? null,
      leaseUntil: opts.leaseUntil ?? null,
      attemptCount: opts.attemptCount ?? 0,
      acceptedSummary: opts.acceptedSummary ?? null,
      createdAt: opts.createdAt ?? new Date(),
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  return id;
}

export async function leerImport(id: string) {
  const [row] = await getDb()
    .select()
    .from(catalogImports)
    .where(eq(catalogImports.id, id))
    .limit(1);
  return row ?? null;
}

/** Cierra un import sembrado. Hace falta porque el indice unico parcial admite **uno solo**
 * no terminal por negocio: un caso que deja un `ready` vivo le rompe el seed al siguiente. */
export async function cerrarImport(id: string): Promise<void> {
  await getDb()
    .update(catalogImports)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(catalogImports.id, id));
}

export async function productosDe(businessId: string) {
  return getDb()
    .select({
      id: products.id,
      name: products.name,
      unitPrice: products.unitPrice,
      unitCost: products.unitCost,
      categoryId: products.categoryId,
    })
    .from(products)
    .where(eq(products.businessId, businessId));
}

export async function categoriasDe(businessId: string) {
  return getDb()
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.businessId, businessId));
}

/**
 * Borra **solo lo del negocio sembrado**, por id explicito y en orden de dependencias.
 * Ninguna linea de acá toca una fila que el test no haya creado.
 */
export async function limpiarNegocio(seed: SeedImport): Promise<void> {
  const db = getDb();
  await db
    .delete(catalogImportCleanups)
    .where(eq(catalogImportCleanups.businessId, seed.businessId));
  await db
    .delete(catalogImportFiles)
    .where(eq(catalogImportFiles.businessId, seed.businessId));
  await db
    .delete(catalogImports)
    .where(eq(catalogImports.businessId, seed.businessId));
  await db.delete(products).where(eq(products.businessId, seed.businessId));
  await db
    .delete(productCategories)
    .where(eq(productCategories.businessId, seed.businessId));
  await db
    .delete(memberships)
    .where(eq(memberships.businessId, seed.businessId));
  await db.delete(businesses).where(eq(businesses.id, seed.businessId));
  await db.delete(users).where(eq(users.id, seed.userId));
}

/** Los usuarios extra (integrantes) se borran por id, uno por uno. */
export async function limpiarUsuarios(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await getDb().delete(users).where(eq(users.id, userId));
  }
}
