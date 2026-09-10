import { describe, expect, it, vi } from "vitest";
import { dropBusiness } from "./counter-integration-support";
import {
  VERIFIED_ADDRESS,
  integrationEnabled,
  providerSelection,
  readLocationRow,
  readVerifications,
  seedLocationsBusiness,
} from "./locations-integration-support";
import { createLocation, listLocations, updateLocation } from "./locations";

// The Geoapify HTTP call is NOT under test here (it needs the private key and the
// network); its contract already has `location-providers.test.ts`. What IS under test is
// what gets PERSISTED for each of the two classes of decision 3, and that is read by SQL.
vi.mock("./location-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./location-providers")>();
  return { ...actual, verifyLocation: vi.fn(async () => VERIFIED_ADDRESS) };
});

describe.skipIf(!integrationEnabled)(
  "locations against Neon (spec 0061)",
  () => {
    it("a Geoapify selection is stored georeferenced, with its verification", async () => {
      const seed = await seedLocationsBusiness("Georef", "plus");
      try {
        const created = await createLocation(seed.business, {
          name: "Sucursal Amazonas",
          address: providerSelection,
        });

        const row = await readLocationRow(created.id);
        expect(row.longitude).toBe("-78.4877000");
        expect(row.latitude).toBe("-0.1807000");
        expect(row.status).toBe("active");
        expect(row.addressLabel).toBe(VERIFIED_ADDRESS.label);

        const verifications = await readVerifications(created.id);
        expect(verifications).toHaveLength(1);
        expect(verifications[0].source).toBe("provider_verified");
        expect(verifications[0].provider).toBe("geoapify");
        expect(verifications[0].supersededAt).toBeNull();
        expect(row.activeVerificationId).toBe(verifications[0].id);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 30_000);

    it("a typed address Geoapify cannot find is stored WITHOUT coordinates", async () => {
      const seed = await seedLocationsBusiness("Tipeado", "plus");
      try {
        const created = await createLocation(seed.business, {
          name: "Sucursal del pueblo",
          address: { label: "Frente a la plaza, sin número" },
        });

        // The DoD, asserted exactly as written: `longitude IS NULL AND latitude IS NULL
        // AND source = 'owner_typed'`, read by SQL and not from the API response.
        const row = await readLocationRow(created.id);
        expect(row.longitude).toBeNull();
        expect(row.latitude).toBeNull();
        expect(row.addressLabel).toBe("Frente a la plaza, sin número");

        const [verification] = await readVerifications(created.id);
        expect(verification.source).toBe("owner_typed");
        expect(verification.provider).toBeNull();
        expect(verification.providerPlaceId).toBeNull();
        expect(verification.longitude).toBeNull();
        expect(verification.latitude).toBeNull();
        expect(verification.attribution).toBeNull();
        expect(verification.providerSnapshot).toEqual({});
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 30_000);

    it("nothing beyond name, address and status leaves towards the browser", async () => {
      const seed = await seedLocationsBusiness("DTO", "plus");
      try {
        const created = await createLocation(seed.business, {
          name: "Sucursal Amazonas",
          address: providerSelection,
        });
        const listed = await listLocations(seed.business.id);

        // Anti-false-green: the row this DTO comes from DOES carry the snapshot and the
        // coordinates (asserted above), so an empty key list here would be suspicious.
        for (const location of [created, ...listed]) {
          expect(Object.keys(location).sort()).toEqual([
            "addressLabel",
            "id",
            "name",
            "status",
          ]);
        }
        expect(JSON.stringify(listed)).not.toContain("place-123");
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 30_000);

    it("moving the address supersedes the old verification and keeps its row", async () => {
      const seed = await seedLocationsBusiness("Mudanza", "plus");
      try {
        const before = await readVerifications(seed.locationId);
        expect(before).toHaveLength(1);
        const oldVerificationId = before[0].id;

        await updateLocation(seed.business, seed.locationId, {
          address: { label: "Nueva dirección 456" },
        });

        const after = await readVerifications(seed.locationId);
        const live = after.filter((v) => v.supersededAt === null);
        const superseded = after.filter((v) => v.supersededAt !== null);

        // Exactly one live verification, and it is the NEW one.
        expect(after).toHaveLength(2);
        expect(live).toHaveLength(1);
        expect(live[0].id).not.toBe(oldVerificationId);
        expect(live[0].normalizedAddress).toBe("Nueva dirección 456");

        // The old row still exists — provenance is never destroyed — with its stamp.
        expect(superseded).toHaveLength(1);
        expect(superseded[0].id).toBe(oldVerificationId);
        expect(superseded[0].normalizedAddress).toBe("Calle 1");
        expect(superseded[0].supersededAt).toBeInstanceOf(Date);

        // And the location points at the new one.
        const row = await readLocationRow(seed.locationId);
        expect(row.activeVerificationId).toBe(live[0].id);
        expect(row.addressLabel).toBe("Nueva dirección 456");
        // The seed was georeferenced; the new address is typed-only, so the coordinates
        // are CLEARED rather than left pointing at the old building.
        expect(row.longitude).toBeNull();
        expect(row.latitude).toBeNull();
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 30_000);

    it("renaming touches neither the address nor the active verification", async () => {
      const seed = await seedLocationsBusiness("Renombre", "plus");
      try {
        const before = await readLocationRow(seed.locationId);
        const renamed = await updateLocation(seed.business, seed.locationId, {
          name: "Sucursal Norte",
        });
        expect(renamed.name).toBe("Sucursal Norte");

        const after = await readLocationRow(seed.locationId);
        expect(after.addressLabel).toBe(before.addressLabel);
        expect(after.longitude).toBe(before.longitude);
        expect(after.latitude).toBe(before.latitude);
        expect(after.activeVerificationId).toBe(before.activeVerificationId);
        // No verification row was written: still exactly the one the seed created.
        expect(await readVerifications(seed.locationId)).toHaveLength(1);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 30_000);

    it("an edit with nothing to change is refused instead of silently passing", async () => {
      const seed = await seedLocationsBusiness("Vacio", "plus");
      try {
        await expect(
          updateLocation(seed.business, seed.locationId, {}),
        ).rejects.toMatchObject({ status: 422, code: "invalid_input" });
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 30_000);
  },
);
