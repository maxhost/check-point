import { and, count, eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { dropBusiness } from "./counter-integration-support";
import {
  integrationEnabled,
  readLocationRow,
  readVerifications,
  seedLocationsBusiness,
} from "./locations-integration-support";
import { getDb } from "./db";
import { locations, locationVerifications } from "./schema";
import { createLocation, updateLocation } from "./locations";

/**
 * Spec 0061 — the two invariants this domain claims to hold UNDER CONCURRENCY, each
 * asserted by reading the final state with SQL (ADR 0054 §4).
 *
 * They exist because `CLAUDE.md` forbids claiming «atomic/idempotent» from a code read:
 * `createLocation`'s cap and `updateLocation`'s supersede are both guards that a plain
 * pre-check evaluates once, before anybody blocks. The mutation results are transcribed
 * in the spec 0061 handoff.
 */
async function activeCount(businessId: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(locations)
    .where(
      and(eq(locations.businessId, businessId), eq(locations.status, "active")),
    );
  return Number(row.value);
}

async function liveVerifications(locationId: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(locationVerifications)
    .where(
      and(
        eq(locationVerifications.locationId, locationId),
        isNull(locationVerifications.supersededAt),
      ),
    );
  return Number(row.value);
}

describe.skipIf(!integrationEnabled)(
  "locations under concurrency (spec 0061)",
  () => {
    it("four simultaneous creates never walk a plus business past three active", async () => {
      const seed = await seedLocationsBusiness("Carrera", "plus");
      try {
        expect(await activeCount(seed.business.id)).toBe(1);

        const attempts = await Promise.allSettled(
          ["A", "B", "C", "D"].map((tag) =>
            createLocation(seed.business, {
              name: `Sucursal ${tag}`,
              address: { label: `Calle ${tag} 1` },
            }),
          ),
        );
        const created = attempts.filter((a) => a.status === "fulfilled");
        const refused = attempts.filter((a) => a.status === "rejected");

        // Two slots were free (limit 3, one taken), so exactly two may win.
        expect(created).toHaveLength(2);
        expect(refused).toHaveLength(2);
        for (const attempt of refused) {
          expect((attempt as PromiseRejectedResult).reason).toMatchObject({
            status: 409,
            code: "location_limit",
          });
        }
        // The oracle is the table, not the count of resolved promises.
        expect(await activeCount(seed.business.id)).toBe(3);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("two simultaneous address edits leave exactly one live verification", async () => {
      const seed = await seedLocationsBusiness("Mudanzas", "plus");
      try {
        expect(await liveVerifications(seed.locationId)).toBe(1);

        await Promise.all([
          updateLocation(seed.business, seed.locationId, {
            address: { label: "Calle Primera 1" },
          }),
          updateLocation(seed.business, seed.locationId, {
            address: { label: "Calle Segunda 2" },
          }),
        ]);

        // The invariant of the DoD: exactly ONE row with `superseded_at IS NULL`.
        expect(await liveVerifications(seed.locationId)).toBe(1);

        // …and it is the one the location points at, with the address the location shows.
        const all = await readVerifications(seed.locationId);
        expect(all).toHaveLength(3);
        const live = all.find((v) => v.supersededAt === null);
        const row = await readLocationRow(seed.locationId);
        expect(row.activeVerificationId).toBe(live?.id);
        expect(row.addressLabel).toBe(live?.normalizedAddress);
        // Nothing was destroyed: the seed's verification and the loser both survive.
        expect(all.filter((v) => v.supersededAt !== null)).toHaveLength(2);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);
  },
);
