/** Owned persistent native-smoke fixtures. Operations only via the protected wrapper. */
import { readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businessOnboardingTours,
  businesses,
  posOrders,
  users,
} from "@mi-pasaporte/db/schema";
import {
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "../../../../../../packages/db/src/local";
import { ONBOARDING_TOURS } from "../../../server/onboarding/tours";
import {
  dropPosWorld,
  seedPosWorld,
  type PosWorld,
} from "./pos-integration-support";
const directory = "/private/tmp/checkpass-pos-0242/scope-client";
const file = `${directory}/native-private.json`;
type Fixture = {
  kind: "scope-client-0242";
  worlds: PosWorld[];
  before: unknown[];
};
describe.skipIf(process.env.POS_SCOPE_CLIENT_NATIVE !== "true")(
  "0242 own scope client fixture",
  () => {
    it("performs only the requested owned operation", async () => {
      expect(process.env.NEON_INTEGRATION_ISOLATED).toBe("true");
      const endpoint = createHash("sha256")
        .update(neonEndpointId(process.env.NEON_INTEGRATION_DATABASE_URL!))
        .digest("hex")
        .slice(0, 12);
      expect(endpoint).not.toBe(PROD_DB_ENDPOINT_SHA12);
      expect(endpoint).toBe(process.env.POS_MEASUREMENT_ENDPOINT_SHA12);
      expect(process.env.BETTER_AUTH_URL).toBe("http://localhost:43242");
      const op = process.env.POS_SCOPE_CLIENT_OPERATION;
      if (op === "setup") {
        const fixture: Fixture = {
          kind: "scope-client-0242",
          worlds: [],
          before: [],
        };
        await writeFile(file, JSON.stringify(fixture), {
          flag: "wx",
          mode: 0o600,
        });
        for (const label of ["scope-client-0242-A", "scope-client-0242-B"]) {
          const world = await seedPosWorld(label);
          fixture.worlds.push(world);
          await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
          await getDb()
            .insert(businessOnboardingTours)
            .values(
              ONBOARDING_TOURS.map((tourId) => ({
                businessId: world.seed.business.id,
                tourId,
                status: "completed" as const,
              })),
            );
        }
        fixture.before = await snapshot(fixture);
        await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
      } else {
        expect((await stat(file)).mode & 0o077).toBe(0);
        const fixture = JSON.parse(await readFile(file, "utf8")) as Fixture;
        expect(fixture.kind).toBe("scope-client-0242");
        expect(fixture.worlds).toHaveLength(2);
        if (op === "inspect") {
          expect(await snapshot(fixture)).toEqual(fixture.before);
          await writeFile(
            `${directory}/native-inspection.json`,
            JSON.stringify({ unchanged: true, ownedBusinesses: 2, endpoint }),
            { mode: 0o600 },
          );
        } else if (op === "cleanup") {
          for (const world of fixture.worlds) {
            // Verify ownership before deleting an aggregate root.
            const [owned] = await getDb()
              .select({ name: businesses.name })
              .from(businesses)
              .where(eq(businesses.id, world.seed.business.id));
            expect(owned?.name).toContain("scope-client-0242");
            await dropPosWorld(world);
            await getDb().delete(users).where(eq(users.id, world.seed.userId));
          }
          for (const world of fixture.worlds)
            expect(
              await getDb()
                .select()
                .from(posOrders)
                .where(eq(posOrders.businessId, world.seed.business.id)),
            ).toHaveLength(0);
          await writeFile(
            `${directory}/native-cleanup.json`,
            JSON.stringify({ removed: true, ownedBusinesses: 2 }),
            { mode: 0o600 },
          );
        } else throw Error("Unknown owned fixture operation");
      }
    }, 120_000);
  },
);
async function snapshot(fixture: Fixture) {
  return JSON.parse(
    JSON.stringify(
      await getDb()
        .select()
        .from(posOrders)
        .where(
          inArray(
            posOrders.businessId,
            fixture.worlds.map((world) => world.seed.business.id),
          ),
        )
        .orderBy(posOrders.id),
    ),
  ) as unknown[];
}
