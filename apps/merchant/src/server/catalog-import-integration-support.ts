import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
/** Si la rama de Neon esta cableada. Mismo interruptor que las otras 100 suites. */
export const importIntegrationEnabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// `getDb()` lee `DATABASE_URL` de forma perezosa; apuntarlo ANTES de importarlo.
if (importIntegrationEnabled) process.env.DATABASE_URL = url;

import { getDb } from "@mi-pasaporte/db";
import { seedTrialSubscription } from "./counter-integration-support";
import { MENU_EXTRACTION_TASK } from "./catalog-import/menu-task";
import {
  aiRequests,
  businesses,
  catalogImportCleanups,
  catalogImportFiles,
  catalogImports,
  memberships,
  productCategories,
  products,
  users,
} from "@mi-pasaporte/db/schema";

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
  await seedTrialSubscription(businessId);
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
      // Spec 0218: el integrante que OPERA ya cambio su PIN temporal (si no, la compuerta lo
      // corta con 403 `pin_change_required` antes de cualquier superficie).
      pinMustChange: false,
    });
  return userId;
}

/** Inserta un import con el estado que el caso necesita, sin pasar por la API. El uso del proveedor
 * ya no vive en el import (spec 0224): lo siembra `sembrarUsoMenu`. */
export async function seedImport(opts: {
  businessId: string;
  userId: string;
  status: string;
  draft?: unknown;
  createdAt?: Date;
  expiresAt?: Date;
  providerJobId?: string | null;
  leaseUntil?: Date | null;
  attemptCount?: number;
  acceptedSummary?: unknown;
}): Promise<string> {
  const [id] = await seedImports(1, opts);
  return id;
}

/** `n` imports en UN `insert`: los topes del cupo estan en valor de pruebas (100), y sembrarlos de a
 * uno serian 100 viajes a Neon (o 100 conexiones con `Promise.all`). */
export async function seedImports(
  cantidad: number,
  opts: Parameters<typeof seedImport>[0],
): Promise<string[]> {
  if (cantidad <= 0) return [];
  const ids = Array.from({ length: cantidad }, () => randomUUID());
  await getDb()
    .insert(catalogImports)
    .values(
      ids.map((id) => ({
        id,
        businessId: opts.businessId,
        createdByUserId: opts.userId,
        status: opts.status,
        sourceKind: "images",
        fileCount: 1,
        draft: opts.draft ?? null,
        providerJobId: opts.providerJobId ?? null,
        leaseUntil: opts.leaseUntil ?? null,
        attemptCount: opts.attemptCount ?? 0,
        acceptedSummary: opts.acceptedSummary ?? null,
        createdAt: opts.createdAt ?? new Date(),
        expiresAt: opts.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      })),
    );
  return ids;
}

/** Spec 0224 — las filas de `core.ai_request` que deja `submitAiTask` cuando el proveedor ACEPTA el
 * submit (una por import: `subjectId`). `task` por defecto la del menu. Se borran en cascada con el
 * negocio. */
export async function sembrarUsoMenu(opts: {
  businessId: string;
  subjectIds: (string | null)[];
  status?: "pending" | "ok" | "failed";
  task?: string;
  mode?: "sync" | "background";
  createdAt?: Date;
}): Promise<void> {
  const status = opts.status ?? "pending";
  if (opts.subjectIds.length === 0) return;
  await getDb()
    .insert(aiRequests)
    .values(
      opts.subjectIds.map((subjectId) => ({
        businessId: opts.businessId,
        task: opts.task ?? MENU_EXTRACTION_TASK.id,
        taskVersion: "v2",
        mode: opts.mode ?? "background",
        provider: "openai",
        status,
        failureCode: status === "failed" ? "provider_error" : null,
        subjectId,
        createdAt: opts.createdAt ?? new Date(),
        finishedAt: status === "pending" ? null : new Date(),
      })),
    );
}

/** Las filas de uso del negocio (para aseverar el registro). */
export async function usosDe(businessId: string) {
  return getDb()
    .select()
    .from(aiRequests)
    .where(eq(aiRequests.businessId, businessId));
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

/** Una categoria del catalogo REAL del negocio, para que la importacion la concilie. */
export async function sembrarCategoria(
  businessId: string,
  name: string,
  createdAt?: Date,
): Promise<string> {
  const [row] = await getDb()
    .insert(productCategories)
    .values({ businessId, name, ...(createdAt ? { createdAt } : {}) })
    .returning({ id: productCategories.id });
  return row.id;
}

/** Un producto del catalogo REAL. `unitPrice` viaja como el decimal en string del repo. */
export async function sembrarProducto(opts: {
  businessId: string;
  name: string;
  categoryId?: string | null;
  unitPrice?: string | null;
}): Promise<string> {
  const [row] = await getDb()
    .insert(products)
    .values({
      businessId: opts.businessId,
      name: opts.name,
      categoryId: opts.categoryId ?? null,
      unitPrice: opts.unitPrice ?? null,
    })
    .returning({ id: products.id });
  return row.id;
}

export async function productosDe(businessId: string) {
  return getDb()
    .select({
      id: products.id,
      name: products.name,
      unitPrice: products.unitPrice,
      unitCost: products.unitCost,
      categoryId: products.categoryId,
      availableAllLocations: products.availableAllLocations,
    })
    .from(products)
    .where(eq(products.businessId, businessId));
}

export async function categoriasDe(businessId: string) {
  return getDb()
    .select({
      id: productCategories.id,
      name: productCategories.name,
      createdAt: productCategories.createdAt,
    })
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
