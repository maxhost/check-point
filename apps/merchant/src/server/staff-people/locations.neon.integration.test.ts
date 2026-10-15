import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import { eq } from "drizzle-orm";
import {
  permisosIntegrationEnabled,
  limpiarNegocios,
} from "../permissions-integration-support";
import { SERVER_MODULES } from "../../modules/server-registry";
import { listStaffLocationTimeline } from "../staff-location-timeline";
import { setLocationStatus } from "../locations/store";
import { staffPeopleWorld, peopleApi } from "./integration-support";
const run = permisosIntegrationEnabled ? describe : describe.skip;
const contributorId = "staff-maintenance-fixture";

run(
  "0231 assignment timeline and atomic generic maintenance",
  { timeout: 60000 },
  () => {
    let world: Awaited<ReturnType<typeof staffPeopleWorld>>;
    let calls = 0,
      fail = false;
    beforeAll(async () => {
      world = await staffPeopleWorld();
      (SERVER_MODULES as Record<string, (typeof SERVER_MODULES)[string]>)[
        contributorId
      ] = {
        routes: [],
        staffLocationsChanged: async (tx, change) => {
          calls++;
          await tx
            .update(businesses)
            .set({ name: `derived-${change.fromMonth}` })
            .where(eq(businesses.id, change.businessId));
          if (fail)
            throw new Error(
              "Sensitive internal monetary payload must never escape",
            );
        },
      };
    });
    afterAll(async () => {
      delete (
        SERVER_MODULES as Record<string, (typeof SERVER_MODULES)[string]>
      )[contributorId];
      await limpiarNegocios([world.business.id], world.users);
    });
    async function create() {
      const result = await peopleApi.create(world.cookie, {
        name: randomUUID(),
        access: { enabled: false },
        locationIds: [world.locations[0]],
        fromMonth: "2026-01",
      });
      expect(result.status).toBe(201);
      return (await result.json()).person;
    }
    async function timeline(id: string) {
      return withDbTransaction((tx) =>
        listStaffLocationTimeline(tx, world.business.id, id),
      );
    }

    it("keeps prior and future frontiers/IDs, normalizes duplicate UUIDs and no-ops the same set", async () => {
      const p = await create();
      const initial = (await timeline(p.id))[0];
      const future = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: p.revision,
        fromMonth: "2026-05",
        locationIds: [world.locations[1]],
      });
      expect(future.status).toBe(200);
      const f = (await future.json()).person;
      const march = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: f.revision,
        fromMonth: "2026-03",
        locationIds: [
          world.locations[1],
          world.locations[0],
          world.locations[0].toUpperCase(),
        ],
      });
      expect(march.status).toBe(200);
      const m = (await march.json()).person,
        before = calls;
      const rows = await timeline(p.id);
      expect(
        rows.map((r) => [r.fromMonth, r.untilMonth, r.locationIds]),
      ).toEqual([
        ["2026-01-01", "2026-03-01", [world.locations[0]]],
        ["2026-03-01", "2026-05-01", [world.locations[0], world.locations[1]]],
        ["2026-05-01", null, [world.locations[1]]],
      ]);
      expect(rows[0].id).toBe(initial.id);
      const repeated = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: m.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[1].toUpperCase(), world.locations[0]],
      });
      expect(repeated.status).toBe(200);
      expect((await repeated.json()).person.revision).toBe(m.revision);
      expect(calls).toBe(before);
      expect(await timeline(p.id)).toEqual(rows);
      const feb = (
        await (await peopleApi.list(world.cookie, "2026-02")).json()
      ).people.find((row: { id: string }) => row.id === p.id);
      expect(feb.locationIds).toEqual([world.locations[0]]);
    });
    it("runs callbacks without activation and rolls back assignment/revision/derived writes on sanitized failure", async () => {
      const p = await create(),
        before = await timeline(p.id);
      const [businessBefore] = await getDb()
        .select({ name: businesses.name })
        .from(businesses)
        .where(eq(businesses.id, world.business.id));
      fail = true;
      const response = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: p.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[1]],
      });
      fail = false;
      expect(response.status).toBe(503);
      const error = await response.json();
      expect(error.code).toBe("assignment_update_failed");
      expect(JSON.stringify(error)).not.toContain("Sensitive");
      expect(await timeline(p.id)).toEqual(before);
      expect(
        (
          await getDb()
            .select({ name: businesses.name })
            .from(businesses)
            .where(eq(businesses.id, world.business.id))
        )[0],
      ).toEqual(businessBefore);
      const retry = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: p.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[1]],
      });
      expect(retry.status).toBe(200);
      expect((await timeline(p.id)).length).toBe(2);
    });
    it("serializes stale edits and rejects empty/foreign/new archived assignments while retaining an assigned archived local", async () => {
      const p = await create();
      const body = {
        expectedRevision: p.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[1]],
      };
      const concurrent = await Promise.all([
        peopleApi.locations(world.cookie, p.id, body),
        peopleApi.locations(world.cookie, p.id, {
          ...body,
          locationIds: [world.locations[2]],
        }),
      ]);
      expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await timeline(p.id)).length).toBe(2);
      const current = (
        await (await peopleApi.list(world.cookie, "2026-03")).json()
      ).people.find((row: { id: string }) => row.id === p.id);
      expect(
        (
          await peopleApi.locations(world.cookie, p.id, {
            expectedRevision: current.revision,
            fromMonth: "2026-03",
            locationIds: [],
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await peopleApi.locations(world.cookie, p.id, {
            expectedRevision: current.revision,
            fromMonth: "2026-03",
            locationIds: [randomUUID()],
          })
        ).status,
      ).toBe(404);
      await setLocationStatus(world.business, world.locations[0], "archived");
      const newArchived = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: current.revision,
        fromMonth: "2026-03",
        locationIds: [world.locations[0]],
      });
      expect(newArchived.status).toBe(409);
      const retained = await peopleApi.locations(world.cookie, p.id, {
        expectedRevision: current.revision,
        fromMonth: "2026-01",
        locationIds: [world.locations[0], world.locations[1]],
      });
      expect(retained.status).toBe(200);
    });
  },
);
