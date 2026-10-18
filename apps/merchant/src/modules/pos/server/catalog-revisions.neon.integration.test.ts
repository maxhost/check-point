import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  productLocations,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  type OwnerBusiness,
} from "@mi-pasaporte/domain/server/catalog";
import * as image from "@mi-pasaporte/domain/server/catalog/image";
import { deleteProductPrefix } from "@mi-pasaporte/domain/server/r2";
import {
  importIntegrationEnabled,
  seedNegocio,
  limpiarNegocio,
  seedImport,
  cerrarImport,
  sembrarCategoria,
  type SeedImport,
} from "../../../server/catalog-import-integration-support";
import { writeImportedCatalog } from "../../../server/catalog-import/write";

// External effects only: every catalog/header/link/import operation uses real PostgreSQL.
vi.mock("@mi-pasaporte/domain/server/r2", async () => ({
  ...(await vi.importActual<typeof import("@mi-pasaporte/domain/server/r2")>(
    "@mi-pasaporte/domain/server/r2",
  )),
  deleteObjectKeys: vi.fn(async () => undefined),
  deleteProductPrefix: vi.fn(async () => undefined),
}));

const ddlName = `catalog_revision_${randomUUID().replaceAll("-", "")}`;
const triggerName = `${ddlName}_fail`;
let a: SeedImport | undefined;
let b: SeedImport | undefined;
let owner: OwnerBusiness;
let local1: string;
let local2: string;
let foreignLocal: string;
const statement = (value: string) => getDb().execute(sql.raw(value));
async function dropFailureSignal() {
  await statement(
    `DROP TRIGGER IF EXISTS "${triggerName}" ON core.product_location`,
  );
  await statement(`DROP SCHEMA IF EXISTS "${ddlName}" CASCADE`);
}
async function row(id: string) {
  return (await getDb().select().from(products).where(eq(products.id, id)))[0];
}
async function links(id: string) {
  return (
    await getDb()
      .select({ id: productLocations.locationId })
      .from(productLocations)
      .where(eq(productLocations.productId, id))
  )
    .map((r) => r.id)
    .sort();
}
async function location(seed: SeedImport) {
  const id = randomUUID();
  await getDb().insert(locations).values({
    id,
    businessId: seed.businessId,
    name: id,
    addressLabel: "Fixture propia",
    longitude: "0",
    latitude: "0",
    countryCode: "EC",
    addressSnapshot: {},
  });
  return id;
}

describe.skipIf(!importIntegrationEnabled)(
  "0242 CP2a.3 atomic catalog revisions",
  () => {
    beforeAll(async () => {
      a = await seedNegocio("Catalog revision A");
      b = await seedNegocio("Catalog revision B");
      owner = { id: a.businessId, currencyCode: "USD" };
      local1 = await location(a);
      local2 = await location(a);
      foreignLocal = await location(b);
    });
    afterAll(async () => {
      try {
        await dropFailureSignal();
      } finally {
        for (const seed of [a, b])
          if (seed) {
            await limpiarNegocio(seed);
            expect(
              await getDb()
                .select({ id: businesses.id })
                .from(businesses)
                .where(eq(businesses.id, seed.businessId)),
            ).toEqual([]);
            expect(
              await getDb()
                .select({ id: users.id })
                .from(users)
                .where(eq(users.id, seed.userId)),
            ).toEqual([]);
          }
      }
      expect(
        (
          await getDb().execute(
            sql`select nspname from pg_namespace where nspname = ${ddlName}`,
          )
        ).rows,
      ).toEqual([]);
    });

    it("starts unit1, increments once per commercial edit and ignores normalized no-ops/category/image", async () => {
      const input = {
        name: "Revisions",
        unitPrice: "2.00",
        unitCost: "1.00",
        availableAllLocations: false,
        locationIds: [local1, local2],
      };
      const p = await createProduct(owner, input);
      expect(await row(p.id)).toMatchObject({
        soldByWeight: false,
        pricingUnit: "unit",
        salesRevision: 1,
      });
      const categoryId = await sembrarCategoria(
        owner.id,
        "No commercial change",
      );
      await updateProduct(owner, p.id, {
        ...input,
        unitPrice: "0002.000000000",
        unitCost: "01.000",
        categoryId,
        locationIds: [local2.toUpperCase(), local1, local2],
      });
      expect((await row(p.id)).salesRevision).toBe(1);
      await updateProduct(owner, p.id, { ...input, imageAction: "remove" });
      expect((await row(p.id)).salesRevision).toBe(1);
      await updateProduct(owner, p.id, {
        ...input,
        name: "Changed",
        unitPrice: "3",
        unitCost: "2",
        locationIds: [local1],
      });
      expect((await row(p.id)).salesRevision).toBe(2);
      expect(await links(p.id)).toEqual([local1]);
      await updateProduct(owner, p.id, {
        ...input,
        name: "Changed",
        unitPrice: "3",
        unitCost: "2",
        availableAllLocations: true,
      });
      expect((await row(p.id)).salesRevision).toBe(3);
      expect(await links(p.id)).toEqual([]);
      await updateProduct(owner, p.id, {
        name: "Changed",
        unitPrice: null,
        unitCost: null,
      });
      expect((await row(p.id)).salesRevision).toBe(4);
    }, 60_000);

    it("serializes simultaneous full updates without losing increments or mixing link sets", async () => {
      const p = await createProduct(owner, { name: "Concurrent" });
      await Promise.all([
        updateProduct(owner, p.id, {
          name: "Concurrent A",
          unitPrice: "4",
          availableAllLocations: false,
          locationIds: [local1],
        }),
        updateProduct(owner, p.id, {
          name: "Concurrent B",
          unitPrice: "5",
          availableAllLocations: false,
          locationIds: [local2],
        }),
      ]);
      const saved = await row(p.id);
      expect(saved.salesRevision).toBe(3);
      expect(await links(p.id)).toEqual(
        saved.name === "Concurrent A" ? [local1] : [local2],
      );
      expect(saved.unitPrice).toBe(
        saved.name === "Concurrent A" ? "4.000000000" : "5.000000000",
      );
    }, 60_000);

    it("rejects foreign tenant/product/category/local without writes, and preserves the import guard", async () => {
      const p = await createProduct(owner, { name: "Tenant" });
      const before = await row(p.id);
      const other = { id: b!.businessId, currencyCode: "USD" };
      const categoryId = await sembrarCategoria(other.id, "Foreign");
      await expect(
        updateProduct(other, p.id, { name: "Intrusion" }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(deleteProduct(other, p.id)).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        updateProduct(owner, p.id, { name: "Intrusion", categoryId }),
      ).rejects.toMatchObject({ status: 422 });
      await expect(
        updateProduct(owner, p.id, {
          name: "Intrusion",
          availableAllLocations: false,
          locationIds: [foreignLocal],
        }),
      ).rejects.toMatchObject({ status: 422 });
      await expect(
        createProduct(owner, { name: "Intrusion", categoryId }),
      ).rejects.toMatchObject({ status: 422 });
      await expect(
        createProduct(owner, {
          name: "Intrusion",
          availableAllLocations: false,
          locationIds: [foreignLocal],
        }),
      ).rejects.toMatchObject({ status: 422 });
      expect(await row(p.id)).toEqual(before);
      const importId = await seedImport({
        businessId: owner.id,
        userId: a!.userId,
        status: "analyzing",
        leaseUntil: new Date(Date.now() + 3_600_000),
      });
      try {
        await expect(
          createProduct(owner, { name: "Blocked" }),
        ).rejects.toMatchObject({
          status: 409,
          code: "catalog_import_in_progress",
        });
      } finally {
        await cerrarImport(importId);
      }
    }, 60_000);

    it("rolls back header/revision/old links on a controlled failure during link insertion, including create", async () => {
      const p = await createProduct(owner, {
        name: "Rollback",
        availableAllLocations: false,
        locationIds: [local1],
      });
      const before = await row(p.id);
      // Root-authorized transient DDL. Only this suite's exclusive location can raise.
      await statement(`CREATE SCHEMA "${ddlName}"`);
      try {
        await statement(
          `CREATE FUNCTION "${ddlName}".fail_own_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.location_id = '${local2}'::uuid AND EXISTS (SELECT 1 FROM core.product WHERE id = NEW.product_id AND business_id = '${owner.id}'::uuid) THEN RAISE EXCEPTION 'catalog_revision_own_fixture_failure'; END IF; RETURN NEW; END $$`,
        );
        await statement(
          `CREATE TRIGGER "${triggerName}" BEFORE INSERT ON core.product_location FOR EACH ROW EXECUTE FUNCTION "${ddlName}".fail_own_link()`,
        );
        await expect(
          updateProduct(owner, p.id, {
            name: "Must roll back",
            unitPrice: "8",
            availableAllLocations: false,
            locationIds: [local1, local2],
          }),
        ).rejects.toMatchObject({
          cause: { message: "catalog_revision_own_fixture_failure" },
        });
        expect(await row(p.id)).toEqual(before);
        expect(await links(p.id)).toEqual([local1]);
        const name = `Create rollback ${randomUUID()}`;
        await expect(
          createProduct(owner, {
            name,
            availableAllLocations: false,
            locationIds: [local1, local2],
          }),
        ).rejects.toMatchObject({
          cause: { message: "catalog_revision_own_fixture_failure" },
        });
        expect(
          await getDb()
            .select()
            .from(products)
            .where(
              and(eq(products.businessId, owner.id), eq(products.name, name)),
            ),
        ).toEqual([]);
      } finally {
        await dropFailureSignal();
      }
    }, 60_000);

    it("detects image preparation conflict and cleans only its own prepared prefix", async () => {
      const p = await createProduct(owner, { name: "Image race" });
      let resume!: () => void;
      let prepared!: () => void;
      const ready = new Promise<void>((resolve) => {
        prepared = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const ownPrefix = `fixture/${randomUUID()}`;
      const foreignPrefix = `fixture/${randomUUID()}`;
      const spy = vi
        .spyOn(image, "resolveImageChange")
        .mockImplementationOnce(async () => {
          prepared();
          await gate;
          return {
            nextKey: ownPrefix,
            rollback: ownPrefix,
            previous: null,
            attribution: {
              source: null,
              author: null,
              authorUrl: null,
              sourceUrl: null,
            },
          };
        });
      const pending = updateProduct(owner, p.id, {
        name: "Stale",
        imageAction: "replace",
        uploadId: "fixture",
      });
      // Attach rejection assertion before releasing the prepared operation.
      const rejected = expect(pending).rejects.toMatchObject({ status: 409 });
      try {
        await ready;
        // A competing committed image; bypass external preparation only, keep real writer/lock.
        spy.mockResolvedValueOnce({
          nextKey: foreignPrefix,
          rollback: foreignPrefix,
          previous: null,
          attribution: {
            source: "fixture",
            author: "Author",
            authorUrl: null,
            sourceUrl: null,
          },
        });
        await updateProduct(owner, p.id, {
          name: "Image race",
          imageAction: "replace",
          uploadId: "other",
        });
      } finally {
        resume();
      }
      try {
        await rejected;
        expect(await row(p.id)).toMatchObject({
          imageObjectKey: foreignPrefix,
          imageVersion: 1,
          salesRevision: 1,
          name: "Image race",
        });
        expect(deleteProductPrefix).toHaveBeenCalledWith(ownPrefix);
        expect(deleteProductPrefix).not.toHaveBeenCalledWith(foreignPrefix);
        spy.mockRestore();
        await updateProduct(owner, p.id, {
          name: "Image race",
          imageAction: "remove",
        });
        expect((await row(p.id)).salesRevision).toBe(1);
      } finally {
        spy.mockRestore();
      }
    }, 60_000);

    it("imports additive unit1 exactly once while keeping reused/omitted products and metadata intact", async () => {
      const categoryName = `Additive ${randomUUID()}`;
      const categoryId = await sembrarCategoria(owner.id, categoryName);
      const p = await createProduct(owner, {
        name: "Reused",
        categoryId,
        unitPrice: "9",
      });
      await updateProduct(owner, p.id, {
        name: "Reused",
        categoryId,
        unitPrice: "10",
      });
      const before = await row(p.id);
      const omitted = await createProduct(owner, {
        name: `Omitted ${randomUUID()}`,
        unitPrice: "6",
        availableAllLocations: false,
        locationIds: [local1],
      });
      const omittedBefore = await row(omitted.id);
      const importId = await seedImport({
        businessId: owner.id,
        userId: a!.userId,
        status: "analyzing",
        leaseUntil: new Date(Date.now() + 3_600_000),
      });
      const extraction = {
        categories: [
          {
            sourceId: "c",
            name: categoryName,
            products: [
              { sourceId: "old", name: "Reused", priceText: "1" },
              { sourceId: "new", name: "New imported", priceText: "2" },
            ],
          },
        ],
        discarded: [],
        warnings: [],
      };
      const outcomes = await Promise.all([
        writeImportedCatalog(importId, owner.id, extraction),
        writeImportedCatalog(importId, owner.id, extraction),
      ]);
      expect(outcomes.map((o) => o?.created).sort()).toEqual([false, true]);
      for (const outcome of outcomes)
        expect(outcome?.result).toMatchObject({
          productsCreated: 1,
          productsSkipped: 1,
        });
      expect(await row(p.id)).toEqual(before);
      expect(await row(omitted.id)).toEqual(omittedBefore);
      expect(await links(omitted.id)).toEqual([local1]);
      const imported = await getDb()
        .select()
        .from(products)
        .where(
          and(
            eq(products.businessId, owner.id),
            eq(products.categoryId, categoryId),
          ),
        );
      expect(imported).toHaveLength(2);
      expect(imported.find((r) => r.id !== p.id)).toMatchObject({
        soldByWeight: false,
        pricingUnit: "unit",
        salesRevision: 1,
      });
      expect(
        await writeImportedCatalog(importId, b!.businessId, extraction),
      ).toBeNull();
    }, 60_000);
  },
);
