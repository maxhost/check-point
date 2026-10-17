import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;
import {
  BrandError,
  ownerBusiness,
  saveBrand,
} from "@mi-pasaporte/domain/server/brand";
import { readConfiguration, saveConfiguration } from "./business/configuration";
import {
  brandInput,
  seedBrandWorld,
  dropBrandWorld,
} from "./brand-integration-support";
describe.skipIf(!enabled)("brand service against Neon", () => {
  let world: Awaited<ReturnType<typeof seedBrandWorld>>, other: typeof world;
  beforeAll(async () => {
    world = await seedBrandWorld();
    other = await seedBrandWorld();
  }, 30_000);
  afterAll(async () => {
    await dropBrandWorld(world);
    await dropBrandWorld(other);
  }, 30_000);
  it("starts a new business at false/null/false without guessing a country rate", async () => {
    expect(await readConfiguration(world.businessId, "fiscal")).toMatchObject({
      chargesVat: false,
      saleVatRate: null,
      recoversPurchaseVat: false,
    });
  });
  it("bumps the revision on branding save and rejects a stale save with409", async () => {
    const saved = await saveBrand(world.userId, brandInput(1));
    expect(saved.brandRevision).toBe(2);
    expect(saved).toHaveProperty("logoObjectKey");
    await expect(saveBrand(world.userId, brandInput(1))).rejects.toMatchObject({
      status: 409,
    });
    expect(await ownerBusiness(world.userId)).toEqual(saved);
    expect((await saveBrand(world.userId, brandInput(2))).brandRevision).toBe(
      3,
    );
  }, 30_000);
  it("rejects a user without an owner business with403", async () => {
    await expect(
      saveBrand(`ghost-${randomUUID()}`, brandInput(1)),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("still surfaces BrandError for a malformed payload as422 without modifying the business", async () => {
    const before = await ownerBusiness(world.userId);
    await expect(
      saveBrand(world.userId, {
        ...brandInput(before!.brandRevision),
        brandPrimaryColor: "green",
      }),
    ).rejects.toBeInstanceOf(BrandError);
    expect(await ownerBusiness(world.userId)).toEqual(before);
  });
  it("Regional owns currency; branding rejects its old fields and preserves both businesses", async () => {
    const before = (await ownerBusiness(world.userId))!,
      foreign = await ownerBusiness(other.userId);
    const regional = await readConfiguration(world.businessId, "regional");
    expect(regional).toMatchObject({ currencyCode: "USD" });
    await expect(
      saveBrand(world.userId, {
        ...brandInput(before.brandRevision),
        currencyCode: "BRL",
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await ownerBusiness(world.userId)).toEqual(before);
    const saved = await saveConfiguration(world.businessId, "regional", {
      ...regional,
      currencyCode: "BRL",
    });
    expect(saved).toMatchObject({ currencyCode: "BRL" });
    const branded = await saveBrand(
      world.userId,
      brandInput(before.brandRevision),
    );
    expect(branded.currencyCode).toBe("BRL");
    expect(await readConfiguration(world.businessId, "regional")).toEqual(
      saved,
    );
    expect(await ownerBusiness(other.userId)).toEqual(foreign);
  }, 30_000);
  it("Fiscal preserves exact values, branding omissions, retention, null/zero and failed-save atomicity", async () => {
    const initial = await readConfiguration(world.businessId, "fiscal");
    const currentBrand = (await ownerBusiness(world.userId))!;
    const saved = await saveConfiguration(world.businessId, "fiscal", {
      ...initial,
      chargesVat: true,
      saleVatRate: "015.2",
      recoversPurchaseVat: true,
    });
    expect(saved).toMatchObject({
      chargesVat: true,
      saleVatRate: "15.20",
      recoversPurchaseVat: true,
    });
    const branded = await saveBrand(
      world.userId,
      brandInput(currentBrand.brandRevision),
    );
    expect(branded).toMatchObject({
      chargesVat: true,
      saleVatRate: "15.20",
      recoversPurchaseVat: true,
    });
    expect(await readConfiguration(world.businessId, "fiscal")).toEqual(saved);
    const off = await saveConfiguration(world.businessId, "fiscal", {
      ...saved,
      chargesVat: false,
    });
    expect(off).toMatchObject({ saleVatRate: "15.20" });
    const zero = await saveConfiguration(world.businessId, "fiscal", {
      ...off,
      chargesVat: true,
      saleVatRate: "0",
    });
    expect(zero).toMatchObject({ saleVatRate: "0.00" });
    const empty = await saveConfiguration(world.businessId, "fiscal", {
      ...zero,
      chargesVat: false,
      saleVatRate: null,
    });
    expect(empty).toMatchObject({ saleVatRate: null });
    const beforeFailure = await ownerBusiness(world.userId);
    await expect(
      saveConfiguration(world.businessId, "fiscal", {
        ...empty,
        chargesVat: true,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await readConfiguration(world.businessId, "fiscal")).toEqual(empty);
    expect(await ownerBusiness(world.userId)).toEqual(beforeFailure);
    await expect(
      saveConfiguration(world.businessId, "fiscal", {
        ...saved,
        chargesVat: false,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "business_revision_conflict",
    });
    expect(await readConfiguration(world.businessId, "fiscal")).toEqual(empty);
    expect((await ownerBusiness(world.userId))!.brandRevision).toBe(
      branded.brandRevision,
    );
  }, 30_000);
});
