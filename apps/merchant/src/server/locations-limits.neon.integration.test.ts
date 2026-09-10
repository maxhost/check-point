import { and, count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { dropBusiness } from "./counter-integration-support";
import {
  integrationEnabled,
  readLocationRow,
  seedExtraLocation,
  seedLocationsBusiness,
} from "./locations-integration-support";
import { getDb } from "./db";
import { locations } from "./schema";
import {
  createLocation,
  listLocations,
  setLocationStatus,
  updateLocation,
} from "./locations";

/** Locations of a business by status, read by SQL — the oracle for every cap assertion.
 * The API answer is never the oracle (ADR 0054 §4). */
async function countByStatus(businessId: string, status: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(locations)
    .where(
      and(eq(locations.businessId, businessId), eq(locations.status, status)),
    );
  return Number(row.value);
}

const typed = (name: string) => ({
  name,
  address: { label: `${name} 100` },
});

describe.skipIf(!integrationEnabled)(
  "locations — plan cap, last location and isolation (spec 0061)",
  () => {
    it("free with one active location cannot open a second", async () => {
      const seed = await seedLocationsBusiness("Free", "free");
      try {
        expect(await countByStatus(seed.business.id, "active")).toBe(1);
        await expect(
          createLocation(seed.business, typed("Sucursal Sur")),
        ).rejects.toMatchObject({ status: 409, code: "location_limit" });
        // Nothing was written on the way to the rejection.
        expect(await countByStatus(seed.business.id, "active")).toBe(1);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("plus opens up to three and is refused the fourth", async () => {
      const seed = await seedLocationsBusiness("Plus", "plus");
      try {
        // Anti-false-green: the second and third DO get created, so the rejection of the
        // fourth is the cap and not a broken create.
        await createLocation(seed.business, typed("Sucursal Dos"));
        await createLocation(seed.business, typed("Sucursal Tres"));
        expect(await countByStatus(seed.business.id, "active")).toBe(3);

        await expect(
          createLocation(seed.business, typed("Sucursal Cuatro")),
        ).rejects.toMatchObject({ status: 409, code: "location_limit" });
        expect(await countByStatus(seed.business.id, "active")).toBe(3);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("archiving frees a slot — the cap counts ACTIVE locations", async () => {
      const seed = await seedLocationsBusiness("Cupo", "plus");
      try {
        const second = await createLocation(seed.business, typed("Dos"));
        await createLocation(seed.business, typed("Tres"));
        await expect(
          createLocation(seed.business, typed("Cuatro")),
        ).rejects.toMatchObject({ code: "location_limit" });

        await setLocationStatus(seed.business, second.id, "archived");
        expect(await countByStatus(seed.business.id, "active")).toBe(2);
        expect(await countByStatus(seed.business.id, "archived")).toBe(1);

        const fourth = await createLocation(seed.business, typed("Cuatro"));
        expect(fourth.status).toBe("active");
        expect(await countByStatus(seed.business.id, "active")).toBe(3);
        // The archived one is still there, untouched: archiving is not deleting.
        expect((await readLocationRow(second.id)).status).toBe("archived");
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("the LAST active location cannot be archived", async () => {
      const seed = await seedLocationsBusiness("Ultimo", "plus");
      try {
        await expect(
          setLocationStatus(seed.business, seed.locationId, "archived"),
        ).rejects.toMatchObject({
          status: 409,
          code: "last_active_location",
        });
        expect((await readLocationRow(seed.locationId)).status).toBe("active");

        // Anti-false-green: with a second active location the SAME call succeeds, so the
        // rejection is the "last one" rule and not a broken archive.
        await seedExtraLocation(seed.business.id, "Sucursal Sur");
        const archived = await setLocationStatus(
          seed.business,
          seed.locationId,
          "archived",
        );
        expect(archived.status).toBe("archived");
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("reactivating obeys the same cap, so archive→create→reactivate cannot walk past it", async () => {
      // Derived consequence, flagged in the handoff: the owner decided the cap counts
      // ACTIVE locations; if reactivating ignored it, a `free` business could hold two.
      const seed = await seedLocationsBusiness("Reactivar", "free");
      try {
        const spare = await seedExtraLocation(seed.business.id, "Sur");
        await setLocationStatus(seed.business, spare, "archived");
        expect(await countByStatus(seed.business.id, "active")).toBe(1);

        await expect(
          setLocationStatus(seed.business, spare, "active"),
        ).rejects.toMatchObject({ status: 409, code: "location_limit" });
        expect((await readLocationRow(spare)).status).toBe("archived");
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("an owner cannot list, edit or archive a location of another business", async () => {
      const mine = await seedLocationsBusiness("Propio", "plus");
      const other = await seedLocationsBusiness("Ajeno", "plus");
      try {
        await seedExtraLocation(other.business.id, "Sur ajeno");

        const listed = await listLocations(mine.business.id);
        expect(listed.map((l) => l.id)).toEqual([mine.locationId]);
        expect(listed.map((l) => l.id)).not.toContain(other.locationId);

        await expect(
          updateLocation(mine.business, other.locationId, {
            name: "Secuestrado",
          }),
        ).rejects.toMatchObject({ status: 404, code: "unknown_location" });
        await expect(
          updateLocation(mine.business, other.locationId, {
            address: { label: "Otra calle 1" },
          }),
        ).rejects.toMatchObject({ status: 404, code: "unknown_location" });
        await expect(
          setLocationStatus(mine.business, other.locationId, "archived"),
        ).rejects.toMatchObject({ status: 404, code: "unknown_location" });

        // Nothing of the other business moved.
        const untouched = await readLocationRow(other.locationId);
        expect(untouched.name).toBe("Ajeno centro");
        expect(untouched.addressLabel).toBe("Calle 1");
        expect(untouched.status).toBe("active");
      } finally {
        await dropBusiness(mine.business.id);
        await dropBusiness(other.business.id);
      }
    }, 60_000);

    it("a malformed location id is a 422, never a database error", async () => {
      const seed = await seedLocationsBusiness("Uuid", "plus");
      try {
        await expect(
          setLocationStatus(seed.business, "not-a-uuid", "archived"),
        ).rejects.toMatchObject({ status: 422, code: "invalid_input" });
        await expect(
          updateLocation(seed.business, "not-a-uuid", { name: "X" }),
        ).rejects.toMatchObject({ status: 422, code: "invalid_input" });
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);
  },
);
